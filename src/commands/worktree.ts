import { spawnSync } from "node:child_process";
import { relative } from "node:path";

import { buildCommand, buildRouteMap } from "@stricli/core";

import type { LocalContext } from "../context.js";
import { mainWorktreeRoot } from "../git.js";
import type { WorktreeDeps } from "../worktree/lib.js";
import {
  createWorktree,
  mergeWorktree,
  removeWorktree,
} from "../worktree/lib.js";
import { spawnRunner } from "../worktree/runner.js";

/**
 * The `claudjar worktree` commands are thin wrappers over `worktree/lib.ts`:
 * they run the operation from the cwd, narrate to stdout, and turn a failed
 * result into a `worktree <verb>: …` line on stderr and exit code 1.
 */
function cliDeps(ctx: LocalContext): WorktreeDeps {
  const proc = ctx.process;
  return {
    run: spawnRunner(proc.env),
    log: (msg) => void proc.stdout.write(msg),
    warn: (msg) => void proc.stderr.write(msg),
    caddyDir: ctx.caddyDir,
    claudeConfig: ctx.claudeConfig,
  };
}

function failer(ctx: LocalContext, verb: string): (msg: string) => void {
  return (msg) => {
    ctx.process.stderr.write(`worktree ${verb}: ${msg}\n`);
    ctx.process.exitCode = 1;
  };
}

interface CreateFlags {
  readonly setup: boolean;
  readonly hooks: boolean;
  readonly milestone?: string;
}

/**
 * `claudjar worktree create <name>` — add a git worktree and bootstrap it from
 * the merged `worktree:` config; see {@link createWorktree}.
 */
async function runWorktreeCreate(
  this: LocalContext,
  flags: CreateFlags,
  name: string,
): Promise<void> {
  const proc = this.process;
  const result = await createWorktree(
    proc.cwd(),
    {
      name,
      setup: flags.setup,
      hooks: flags.hooks,
      milestone: flags.milestone,
    },
    cliDeps(this),
  );
  if (!result.ok) return failer(this, "create")(result.error);
  proc.stdout.write(
    `\nDone. cd ${relative(proc.cwd(), result.path) || result.path}\n`,
  );
}

interface MergeFlags {
  readonly remove: boolean;
  readonly teardown: boolean;
  readonly hooks: boolean;
}

/**
 * `claudjar worktree merge <name>` — merge worktree branch `<name>` into the
 * branch checked out where the command runs; see {@link mergeWorktree}.
 *
 * On a conflict it keeps everything, prints the conflicted paths, and exits 1.
 * There is no interactive hand-off: launching a nested `claude` from inside a
 * session that is already driving the merge stacks two agents on one
 * repository. The caller — human or agent — resolves in place and commits; the
 * conflicted paths are the whole briefing.
 */
async function runWorktreeMerge(
  this: LocalContext,
  flags: MergeFlags,
  name: string,
): Promise<void> {
  const proc = this.process;
  const fail = failer(this, "merge");
  const result = await mergeWorktree(
    proc.cwd(),
    {
      name,
      remove: flags.remove,
      teardown: flags.teardown,
      hooks: flags.hooks,
    },
    cliDeps(this),
  );
  if (!result.ok) {
    fail(result.error);
    if (result.conflicts.length > 0) {
      proc.stdout.write(
        `\nConflicted files:\n${result.conflicts.map((f) => `  - ${f}`).join("\n")}\n` +
          `\nResolve the conflicts and commit.\n`,
      );
    }
    return;
  }
  if (!result.removal) {
    proc.stdout.write(
      `Kept the worktree and branch. Pass --remove to clean up, or run ` +
        `'claudjar worktree remove ${name.trim()}' later.\n`,
    );
    return;
  }
  if (result.removal.hookError) {
    return fail(`merged and removed, but ${result.removal.hookError}`);
  }
  proc.stdout.write(`\nDone.\n`);
}

interface RemoveFlags {
  readonly teardown: boolean;
  readonly hooks: boolean;
}

/**
 * `claudjar worktree remove <name>` — retire a worktree without merging it;
 * see {@link removeWorktree}.
 */
async function runWorktreeRemove(
  this: LocalContext,
  flags: RemoveFlags,
  name: string,
): Promise<void> {
  const fail = failer(this, "remove");
  const result = await removeWorktree(
    this.process.cwd(),
    { name, teardown: flags.teardown, hooks: flags.hooks },
    cliDeps(this),
  );
  if (!result.ok) return fail(result.error);
  if (result.hookError) return fail(`removed, but ${result.hookError}`);
  this.process.stdout.write(`\nDone.\n`);
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
      hooks: {
        kind: "boolean",
        brief: "Run hooks.worktree.create afterwards (use --no-hooks to skip)",
        default: true,
      },
      milestone: {
        kind: "parsed",
        parse: String,
        placeholder: "title",
        brief:
          "Link the worktree to a forge milestone (stamped as worktree.milestone)",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Add a git worktree and bootstrap it from the worktree: config",
    fullDescription:
      "Creates the branch, copies the `worktree.copy:` gitignored files across, " +
      "assigns the next PROJECT_PORT, stamps the worktree's identity into its " +
      "own .jarrin.local.yml, then bootstraps it.\n\n" +
      "Bootstrapping has two stages. `worktree.setup:` runs first — the " +
      "machine-specific recipe from the gitignored local config (install deps for " +
      "THIS machine). `hooks.worktree.create:` runs second — committed, shared " +
      "project policy every clone applies, with WORKTREE_NAME, WORKTREE_PATH, and " +
      "PROJECT_PORT in the environment, plus SOURCE_WORKTREE_NAME, " +
      "SOURCE_WORKTREE_PATH, and SOURCE_PROJECT_PORT naming the worktree this " +
      "command ran in — what a hook needs to carry state (a database, a cache) " +
      "forward into the new tree. Either stage stops at its first failing " +
      "command, leaving the worktree in place to fix by hand.\n\n" +
      "--milestone <title> links the worktree to the forge milestone it was " +
      "made to work, stamped beside its name as `worktree.milestone`.\n\n" +
      "The stack is not started; run `claudjar start` in the new worktree.",
  },
});

const worktreeMergeCommand = buildCommand({
  func: runWorktreeMerge,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Worktree / branch name to merge in (e.g. feature/x)",
          parse: String,
          placeholder: "name",
        },
      ],
    },
    flags: {
      remove: {
        kind: "boolean",
        brief:
          "After a clean merge, also remove the worktree and delete the branch",
        default: false,
      },
      teardown: {
        kind: "boolean",
        brief:
          "With --remove, stop the project stack first (use --no-teardown to skip)",
        default: true,
      },
      hooks: {
        kind: "boolean",
        brief:
          "With --remove, run hooks.worktree.remove (use --no-hooks to skip)",
        default: true,
      },
    },
  },
  docs: {
    brief:
      "Merge a worktree branch into the current branch, keeping the worktree",
    fullDescription:
      "Run from the worktree you want to merge INTO (e.g. main), naming the " +
      "branch to pull in.\n\n" +
      "The worktree and branch are KEPT by default — merging work up is not the " +
      "same as being finished with the worktree. Add --remove to clean up in the " +
      "same step: that stops the worktree's project stack, removes the directory, " +
      "and safely deletes the branch (--no-teardown leaves the stack running).\n\n" +
      "On a conflict nothing is removed: the worktree and branch stay put, the " +
      "conflicted paths are printed, and the merge is left for the caller to " +
      "resolve and commit.",
  },
});

const worktreeRemoveCommand = buildCommand({
  func: runWorktreeRemove,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Worktree / branch name to remove (e.g. feature/x)",
          parse: String,
          placeholder: "name",
        },
      ],
    },
    flags: {
      teardown: {
        kind: "boolean",
        brief:
          "Stop the worktree's project stack first (use --no-teardown to skip)",
        default: true,
      },
      hooks: {
        kind: "boolean",
        brief: "Run hooks.worktree.remove afterwards (use --no-hooks to skip)",
        default: true,
      },
    },
  },
  docs: {
    brief:
      "Remove a worktree: stop its project stack, delete the directory and branch",
    fullDescription:
      "The counterpart to `worktree create`, and the cleanup half of " +
      "`worktree merge --remove`.\n\n" +
      "Stops the worktree's project stack (with its own assigned PROJECT_PORT), " +
      "removes the directory, then deletes the branch with `git branch -d`. That " +
      "safe delete succeeds only when the branch is fully merged, so unmerged work " +
      "is never discarded silently — the branch survives and is reported.\n\n" +
      "Finally it runs `hooks.worktree.remove:` from THIS checkout (the removed " +
      "directory is gone), with the retired worktree's WORKTREE_NAME, " +
      "WORKTREE_PATH, and PROJECT_PORT in the environment. A failing hook is " +
      "reported and exits non-zero, but the removal already happened.\n\n" +
      "Run it from another worktree; removing the one you are standing in is " +
      "refused. --no-teardown removes the worktree while leaving the stack running.",
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
    merge: worktreeMergeCommand,
    remove: worktreeRemoveCommand,
    list: worktreeListCommand,
  },
  docs: {
    brief: "Manage git worktrees with project-specific bootstrap",
  },
});
