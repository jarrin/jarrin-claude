import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { buildCommand } from "@stricli/core";

import { loadEffectiveConfig } from "../config/load.js";
import type { LocalContext } from "../context.js";
import { resolveStack, showsPort, stackStatusText } from "../project/stack.js";
import {
  composeAdditionalContext,
  renderCommands,
  resolveRules,
} from "../session-start/resolve.js";

const TAG = "[jarrin session-start]";

// Session sources that trigger the backup command: a genuinely new session and
// `/clear`. `resume` and `compact` skip it.
const BACKUP_SOURCES = new Set(["startup", "clear"]);

interface HookPayload {
  readonly cwd?: string;
  readonly source?: string;
}

/**
 * SessionStart hook. Reads the hook JSON payload from stdin, resolves the
 * project's rule selection, and emits the combined text as `additionalContext`
 * JSON on stdout. All diagnostics go to stderr — stdout carries only the hook
 * JSON. Semantics mirror the retired Python loader exactly.
 */
async function runSessionStart(this: LocalContext): Promise<void> {
  const proc = this.process;
  const err = (msg: string): void => void proc.stderr.write(msg);

  const payload = await readPayload(proc);
  const cwd = payload.cwd ?? proc.cwd();
  const source = payload.source ?? "";
  const groupRoot = proc.env.JARRIN_GROUP_ROOT ?? dirname(resolve(cwd));

  const claudeDir = join(cwd, ".claude");
  const jarrinYml = join(claudeDir, ".jarrin.yml");
  const jarrinMd = join(claudeDir, ".jarrin-claude.md");

  if (!isFile(jarrinYml)) {
    err(
      `${TAG} ERROR: ${jarrinYml} not found. Create it to declare which rules ` +
        "to load, e.g.\n    rules:\n      - lang-ts\n",
    );
    proc.exitCode = 1;
    return;
  }

  // The hook now reads the committed `.jarrin.yml` AND the gitignored
  // `.jarrin.local.yml`: rules/backup/commands still come from the committed base
  // (merged verbatim), but the per-worktree stack lifecycle needs the local file's
  // stamped `worktree.name`/`worktree.port` to know this worktree's PROJECT_PORT.
  const cfg = loadEffectiveConfig(claudeDir).merged;

  // Back up the repo before a new session (or /clear). A failed backup is fatal.
  if (cfg.backup && BACKUP_SOURCES.has(source)) {
    if (runBackup(this, cfg.backup, cwd) !== 0) {
      err(`${TAG} ERROR: backup command failed; session blocked.\n`);
      proc.exitCode = 1;
      return;
    }
  }

  const ruleBlocks: string[] = [];
  const missing: string[] = [];
  for (const { label, path } of resolveRules(
    cfg,
    cwd,
    groupRoot,
    this.rulesDir,
  )) {
    if (isFile(path)) {
      ruleBlocks.push(readFileSync(path, "utf8").trim());
    } else {
      missing.push(label);
    }
  }
  if (missing.length > 0) {
    err(`${TAG} WARNING: rule(s) not found: ${missing.join(", ")}\n`);
  }

  const extraMd = isFile(jarrinMd) ? readFileSync(jarrinMd, "utf8").trim() : "";

  // Per-worktree project stack. This hook NEVER starts it — the stack is driven
  // by hand (`claudjar start` / `claudjar stop`), and torn down when the worktree
  // is merged away. All the session does is surface the worktree's assigned
  // PROJECT_PORT in context, on startup and /clear. The main checkout, having no
  // stamped worktree identity, is never active.
  const stack = resolveStack(cfg);
  const stackStatus =
    stack.active && showsPort(source)
      ? stackStatusText(stack.name, stack.port)
      : undefined;

  const additionalContext = composeAdditionalContext({
    stackStatus,
    commandsTable:
      cfg.commands.length > 0 ? renderCommands(cfg.commands) : undefined,
    ruleBlocks,
    extraMd: extraMd || undefined,
  });

  if (additionalContext === null) return; // nothing selected — inject nothing

  proc.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    }) + "\n",
  );
}

async function readPayload(proc: NodeJS.Process): Promise<HookPayload> {
  if (proc.stdin.isTTY) return {};
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of proc.stdin) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    const text = Buffer.concat(chunks).toString("utf8").trim();
    if (!text) return {};
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Unreadable/invalid stdin — behave as if no payload was supplied.
  }
  return {};
}

/**
 * Run the project's backup command in the repo root, returning its exit code.
 * Output is relayed to stderr — never stdout, which carries the hook JSON.
 */
function runBackup(ctx: LocalContext, command: string, cwd: string): number {
  ctx.process.stderr.write(`${TAG} backup: ${command}\n`);
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
  });
  if (result.stdout) ctx.process.stderr.write(result.stdout);
  if (result.stderr) ctx.process.stderr.write(result.stderr);
  if (result.error) {
    ctx.process.stderr.write(
      `${TAG} ERROR launching backup: ${result.error.message}\n`,
    );
    return 1;
  }
  return result.status ?? 1;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export const sessionStartCommand = buildCommand({
  func: runSessionStart,
  parameters: { flags: {} },
  docs: {
    brief:
      "[internal] SessionStart hook: inject the project's selected rules (reads stdin JSON)",
    fullDescription:
      "INTERNAL — invoked by Claude Code through ~/.claude/bin/session-start; not " +
      "for manual use.\n\n" +
      "Reads the SessionStart hook payload on stdin, resolves the repo's rule " +
      "selection from .claude/.jarrin.yml (+ .jarrin.local.yml), and writes the " +
      "combined text to stdout as hook JSON. Diagnostics go to stderr, because " +
      "stdout carries the contract.",
  },
});
