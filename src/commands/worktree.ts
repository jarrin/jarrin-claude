import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

import { buildCommand, buildRouteMap } from "@stricli/core";

import { LOCAL_FILE, loadEffectiveConfig } from "../config/load.js";
import type { LocalContext } from "../context.js";
import { branchExists, mainWorktreeRoot } from "../git.js";
import { planWorktree, validateWorktreeName } from "../worktree/plan.js";
import { stampWorktreeName } from "../worktree/stamp.js";

interface CreateFlags {
  readonly setup: boolean;
}

/**
 * `claudjar worktree create <name>` — add a git worktree and bootstrap it from
 * the merged `worktree:` config: create the branch, copy gitignored files across
 * (always `.jarrin.local.yml`, stamped with the worktree's identity), then run
 * the configured setup commands (poetry, docker, …) in the new worktree.
 */
function runWorktreeCreate(
  this: LocalContext,
  flags: CreateFlags,
  name: string,
): void {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);
  const fail = (msg: string): void => {
    proc.stderr.write(`worktree create: ${msg}\n`);
    proc.exitCode = 1;
  };

  const nameError = validateWorktreeName(name);
  if (nameError) return fail(nameError);
  const branch = name.trim();

  const repoRoot = mainWorktreeRoot(proc.cwd());
  if (!repoRoot) return fail("not inside a git repository.");

  const cfg = loadEffectiveConfig(join(repoRoot, ".claude")).merged;
  const plan = planWorktree({ name: branch, repoRoot, cfg: cfg.worktree });

  if (existsSync(plan.path)) {
    return fail(`target already exists: ${plan.path}`);
  }

  // 1. Create the worktree (and branch, unless it already exists).
  const exists = branchExists(repoRoot, branch);
  const gitArgs = exists
    ? ["-C", repoRoot, "worktree", "add", plan.path, branch]
    : ["-C", repoRoot, "worktree", "add", "-b", branch, plan.path];
  out(`Creating worktree ${plan.path} (branch ${branch})…\n`);
  const add = spawnSync("git", gitArgs, { stdio: "inherit" });
  if (add.status !== 0) return fail("`git worktree add` failed.");

  // 2. Carry gitignored files across (env, local settings, local config).
  for (const rel of plan.copy) {
    const src = join(repoRoot, rel);
    if (!existsSync(src)) continue;
    const dest = join(plan.path, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
    out(`  copied ${rel}\n`);
  }

  // 3. Stamp the worktree's identity into its own .jarrin.local.yml so the
  //    todo / staged-planning skills can scope forge work to it.
  const localPath = join(plan.path, ".claude", LOCAL_FILE);
  const existing = existsSync(localPath) ? readFileSync(localPath, "utf8") : "";
  mkdirSync(dirname(localPath), { recursive: true });
  writeFileSync(localPath, stampWorktreeName(existing, branch), "utf8");
  out(`  stamped worktree.name: ${branch} in .claude/${LOCAL_FILE}\n`);

  // 4. Run setup commands in the new worktree, in order; stop on the first fail.
  if (flags.setup && plan.setup.length > 0) {
    out(`Running setup (${String(plan.setup.length)} command(s))…\n`);
    for (const command of plan.setup) {
      out(`  $ ${command}\n`);
      const res = spawnSync(command, {
        cwd: plan.path,
        shell: true,
        stdio: "inherit",
      });
      if (res.status !== 0) {
        return fail(
          `setup command failed (exit ${String(res.status ?? "?")}): ${command}\n` +
            `The worktree exists at ${plan.path}; fix and re-run setup by hand.`,
        );
      }
    }
  } else if (!flags.setup && plan.setup.length > 0) {
    out(
      `Skipped ${String(plan.setup.length)} setup command(s) (--no-setup).\n`,
    );
  }

  out(`\nDone. cd ${relative(proc.cwd(), plan.path) || plan.path}\n`);
}

/** `claudjar worktree list` — thin pass-through to `git worktree list`. */
function runWorktreeList(this: LocalContext): void {
  const proc = this.process;
  const repoRoot = mainWorktreeRoot(proc.cwd()) ?? proc.cwd();
  const res = spawnSync("git", ["-C", repoRoot, "worktree", "list"], {
    stdio: "inherit",
  });
  if (res.status !== 0) {
    proc.stderr.write("worktree list: `git worktree list` failed.\n");
    proc.exitCode = 1;
  }
}

const worktreeCreateCommand = buildCommand({
  func: runWorktreeCreate,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Worktree / branch name (git branch syntax, e.g. feature/x)",
          parse: String,
          placeholder: "name",
        },
      ],
    },
    flags: {
      setup: {
        kind: "boolean",
        brief: "Run the configured setup commands (use --no-setup to skip)",
        default: true,
      },
    },
  },
  docs: {
    brief: "Add a git worktree and bootstrap it from the worktree: config",
  },
});

const worktreeListCommand = buildCommand({
  func: runWorktreeList,
  parameters: { flags: {} },
  docs: { brief: "List this repo's git worktrees" },
});

export const worktreeRoutes = buildRouteMap({
  routes: {
    create: worktreeCreateCommand,
    list: worktreeListCommand,
  },
  docs: {
    brief: "Manage git worktrees with project-specific bootstrap",
  },
});
