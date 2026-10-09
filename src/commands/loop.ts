import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { buildCommand } from "@stricli/core";
import { parse } from "yaml";

import { BASE_FILE } from "../config/load.js";
import type { LocalContext } from "../context.js";
import { toplevel } from "../git.js";
import { runLoop } from "../loop/driver.js";
import { giteaClient, resolveAuth, workOrder } from "../loop/gitea.js";
import type { Milestone } from "../loop/gitea.js";
import { desktopNotify, stashIfDirty } from "../loop/notify.js";
import { claudeRunner } from "../loop/runner.js";

interface LoopFlags {
  readonly repo?: string;
  readonly dryRun: boolean;
  readonly maxIssues: number;
  readonly maxFailures: number;
  readonly model?: string;
  readonly permissionMode: string;
  readonly pollSeconds: number;
  readonly notify: boolean;
}

/**
 * The forge repo the loop works: `backlog.plan.repo`, else `backlog.repo` (backlog
 * reference §1). Empty when neither is set.
 */
export function backlogRepo(yamlText: string): string {
  let doc: unknown;
  try {
    doc = parse(yamlText);
  } catch {
    return "";
  }
  const get = (v: unknown, k: string): unknown =>
    v !== null && typeof v === "object"
      ? (v as Record<string, unknown>)[k]
      : undefined;
  const backlog = get(doc, "backlog");
  for (const candidate of [
    get(get(backlog, "plan"), "repo"),
    get(backlog, "repo"),
  ]) {
    if (typeof candidate === "string" && candidate.trim())
      return candidate.trim();
  }
  return "";
}

/**
 * Two loops may run side by side, but never on the same milestone (one issue worked
 * twice) nor in the same checkout (two sessions editing one working tree).
 */
export function loopLocks(
  stateDir: string,
  repoRoot: string,
  milestones: readonly Milestone[],
): { readonly path: string; readonly what: string }[] {
  const dir = join(stateDir, "locks");
  return [
    {
      path: join(dir, `worktree-${repoRoot.replace(/[^\w.-]/g, "_")}.lock`),
      what: `worktree ${repoRoot}`,
    },
    ...milestones.map((m) => ({
      path: join(dir, `milestone-${String(m.id)}.lock`),
      what: `milestone "${m.title}"`,
    })),
  ];
}

/** All of `locks` or none: a partial set is released before the refusal returns. */
export function acquireLocks(
  locks: readonly { readonly path: string; readonly what: string }[],
): (() => void) | string {
  const held: (() => void)[] = [];
  const releaseAll = (): void => {
    for (const release of held.splice(0)) release();
  };
  for (const { path, what } of locks) {
    const result = acquireLock(path, what);
    if (typeof result === "string") {
      releaseAll();
      return result;
    }
    held.push(result);
  }
  return releaseAll;
}

export function acquireLock(path: string, what: string): (() => void) | string {
  // The first loop on a machine runs before anything has created ~/.claudjar/loop.
  mkdirSync(dirname(path), { recursive: true });
  try {
    const fd = openSync(path, "wx");
    writeFileSync(fd, String(process.pid));
    closeSync(fd);
  } catch (err) {
    if (!isErrnoException(err) || err.code !== "EEXIST") throw err;
    const pid = Number(readFileSync(path, "utf8").trim());
    if (pid > 0 && isAlive(pid))
      return `${what} is already being worked by another loop (pid ${String(pid)})`;
    writeFileSync(path, String(process.pid));
  }
  return () => rmSync(path, { force: true });
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function runLoopCommand(
  this: LocalContext,
  flags: LoopFlags,
  ...milestoneRefs: string[]
): Promise<void> {
  const proc = this.process;
  const out = (line: string): void => void proc.stdout.write(`${line}\n`);
  const fail = (msg: string): void => {
    proc.stderr.write(`loop: ${msg}\n`);
    proc.exitCode = 1;
  };

  const repoRoot = toplevel(proc.cwd());
  if (!repoRoot) return fail("not inside a git repository.");
  let yamlText = "";
  try {
    yamlText = readFileSync(join(repoRoot, ".claude", BASE_FILE), "utf8");
  } catch {
    // No config: only --repo can name the forge repo.
  }
  const repo = flags.repo ?? backlogRepo(yamlText);
  if (!repo)
    return fail(
      "no repo — set backlog.repo in .claude/.jarrin.yml or pass --repo.",
    );

  const auth = resolveAuth(proc.env);
  if (!auth) {
    return fail(
      "no Gitea credentials — set GITEA_HOST / GITEA_ACCESS_TOKEN, or configure the " +
        "`gitea` MCP server in ~/.claude.json.",
    );
  }
  const gitea = giteaClient(auth, repo);

  const milestones: Milestone[] = [];
  for (const ref of milestoneRefs) {
    try {
      milestones.push(await gitea.resolveMilestone(ref));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }

  if (flags.dryRun) {
    for (const m of milestones) {
      const issues = workOrder(await gitea.openIssues(m));
      out(`${m.title} (#${String(m.id)}): ${String(issues.length)} open`);
      for (const i of issues) out(`  #${String(i.number)} ${i.title}`);
    }
    return;
  }

  const stateDir = join(
    homedir(),
    ".claudjar",
    "loop",
    repo.replace("/", "__"),
  );
  const release = acquireLocks(loopLocks(stateDir, repoRoot, milestones));
  if (typeof release === "string") return fail(release);
  const onSignal = (): void => {
    release();
    proc.exit(130);
  };
  proc.once("SIGINT", onSignal);
  proc.once("SIGTERM", onSignal);

  try {
    const summary = await runLoop(
      {
        gitea,
        run: claudeRunner({
          cwd: repoRoot,
          logDir: stateDir,
          permissionMode: flags.permissionMode,
          model: flags.model ?? "",
          claudeBin: proc.env.CLAUDE_BIN ?? "claude",
          out,
        }),
        sleep: (ms) => delay(ms),
        now: () => Date.now(),
        log: out,
        stash: (label) => stashIfDirty(repoRoot, label),
        notify: flags.notify ? desktopNotify : () => {},
      },
      {
        repo,
        milestones,
        maxIssues: flags.maxIssues,
        maxFailures: flags.maxFailures,
        pollMs: Math.max(flags.pollSeconds, 5) * 1000,
      },
    );
    out(`\nloop finished: ${summary.stopReason}`);
    out(
      `  closed:    ${summary.closed.map((i) => `#${String(i.number)}`).join(" ") || "—"}`,
    );
    out(
      `  left open: ${summary.leftOpen.map((i) => `#${String(i.number)}`).join(" ") || "—"}`,
    );
    out(
      `  awaiting:  ${summary.awaiting.map((i) => `#${String(i.number)}`).join(" ") || "—"}`,
    );
    out(`  logs:      ${stateDir}`);
    if (summary.leftOpen.length > 0 || summary.awaiting.length > 0)
      proc.exitCode = 1;
  } finally {
    release();
  }
}

const parseCount = (raw: string): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0)
    throw new Error(`expected a whole number, got "${raw}"`);
  return n;
};

export const loopCommand = buildCommand({
  func: runLoopCommand,
  parameters: {
    positional: {
      kind: "array",
      parameter: {
        brief:
          "Milestone title (exact) or numeric id; worked in the order given",
        parse: String,
      },
      minimum: 1,
    },
    flags: {
      repo: {
        kind: "parsed",
        parse: String,
        brief:
          "Gitea owner/name (default: backlog.plan.repo, else backlog.repo)",
        optional: true,
      },
      dryRun: {
        kind: "boolean",
        brief: "List the queue in work order and exit",
        default: false,
      },
      maxIssues: {
        kind: "parsed",
        parse: parseCount,
        brief: "Stop after this many issues (0 = all)",
        default: "0",
      },
      maxFailures: {
        kind: "parsed",
        parse: parseCount,
        brief: "Stop after this many issues in a row are left open (0 = never)",
        default: "3",
      },
      model: {
        kind: "parsed",
        parse: String,
        brief: "Model for every session (default: Claude Code's own)",
        optional: true,
      },
      permissionMode: {
        kind: "parsed",
        parse: String,
        brief: "Claude Code --permission-mode for the unattended sessions",
        default: "bypassPermissions",
      },
      pollSeconds: {
        kind: "parsed",
        parse: parseCount,
        brief:
          "Seconds between checks for answers once only questions are left",
        default: "60",
      },
      notify: {
        kind: "boolean",
        brief:
          "Desktop notification (notify-send) when a session asks a question",
        default: true,
      },
    },
  },
  docs: {
    brief:
      "Work every open issue in one or more Gitea milestones, one fresh session each",
    fullDescription:
      'Runs `claude -p "Continue <n>"` for each open issue of the given milestones, in ' +
      "order, a new session per issue (the context is cleared between issues). A usage " +
      "limit pauses the loop until it resets, then resumes the same session. A session " +
      "that ends on a question parks its issue: the question is posted on the " +
      "milestone's single open-questions ticket (with a desktop notification linking " +
      "to it), other issues are worked meanwhile, and a reply there resumes that " +
      "session. Once only questions are left the loop polls for answers. Each " +
      "milestone's Loop progress ticket lists its issues with the sessions' steps as " +
      "checkboxes and keeps the loop's state, so a restart resumes interrupted " +
      "sessions and keeps waiting on unanswered questions. An issue " +
      "the session leaves open without a question (blocked) is skipped. Loops may run in parallel as long " +
      "as no two share a worktree or a milestone. Stream logs go to " +
      "~/.claudjar/loop/<owner>__<name>/.",
  },
});
