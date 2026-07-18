import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { buildCommand, buildRouteMap } from "@stricli/core";

import { LOCAL_FILE, loadEffectiveConfig } from "../config/load.js";
import type { LocalContext } from "../context.js";
import {
  branchExists,
  conflictedFiles,
  currentBranch,
  mainWorktreeRoot,
  toplevel,
  worktreeListPorcelain,
} from "../git.js";
import { conflictPrompt, worktreePathForBranch } from "../worktree/merge.js";
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

interface MergeFlags {
  readonly keep: boolean;
  readonly claude: boolean;
}

/**
 * `claudjar worktree merge <name>` — merge worktree branch `<name>` into the
 * branch checked out where the command runs, then tear the worktree down.
 *
 * On a clean merge it removes the worktree and deletes its branch (unless
 * `--keep`). On a conflict it keeps everything and hands off to an interactive
 * `claude` session seeded with a resolution prompt (unless `--no-claude`).
 */
function runWorktreeMerge(
  this: LocalContext,
  flags: MergeFlags,
  name: string,
): void {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);
  const fail = (msg: string): void => {
    proc.stderr.write(`worktree merge: ${msg}\n`);
    proc.exitCode = 1;
  };

  const nameError = validateWorktreeName(name);
  if (nameError) return fail(nameError);
  const branch = name.trim();

  // The merge lands in the worktree the command is invoked from, not the main
  // checkout — you stand on `main` (or wherever) and pull the branch in.
  const target = toplevel(proc.cwd());
  if (!target) return fail("not inside a git repository.");

  if (!branchExists(target, branch)) return fail(`no such branch: ${branch}`);

  const onBranch = currentBranch(target);
  if (onBranch === branch) {
    return fail(
      `'${branch}' is checked out here; run merge from the branch you want to ` +
        `merge it into.`,
    );
  }

  const porcelain = worktreeListPorcelain(target);
  const wtPath = porcelain ? worktreePathForBranch(porcelain, branch) : null;
  if (wtPath && resolve(wtPath) === resolve(target)) {
    return fail(
      `you are inside the worktree for '${branch}'; run merge from the target ` +
        `worktree instead.`,
    );
  }

  out(`Merging ${branch} into ${onBranch ?? "HEAD"}…\n`);
  const merge = spawnSync("git", ["-C", target, "merge", "--no-edit", branch], {
    stdio: "inherit",
  });

  if (merge.status !== 0) {
    const files = conflictedFiles(target);
    if (files.length === 0) {
      return fail("`git merge` failed (not a conflict); resolve and retry.");
    }
    proc.stderr.write(
      `worktree merge: conflict in ${String(files.length)} file(s); ` +
        `worktree and branch kept.\n`,
    );
    if (!flags.claude) {
      out(
        `\nConflicted files:\n${files.map((f) => `  - ${f}`).join("\n")}\n` +
          `\nResolve the conflicts and commit. (--no-claude: not launching claude.)\n`,
      );
      proc.exitCode = 1;
      return;
    }
    const prompt = conflictPrompt({
      branch,
      targetBranch: onBranch ?? "HEAD",
      files,
    });
    out(`\nLaunching claude to resolve the conflict…\n`);
    const claude = spawnSync("claude", [prompt], {
      cwd: target,
      stdio: "inherit",
    });
    if (claude.error) {
      proc.stderr.write(
        `worktree merge: could not launch 'claude' (${claude.error.message}).\n`,
      );
      out(`\nResolve manually with this prompt:\n\n${prompt}\n`);
      proc.exitCode = 1;
    }
    return;
  }

  out(`Merged ${branch} cleanly.\n`);

  if (flags.keep) {
    out(`Kept the worktree and branch (--keep).\n`);
    return;
  }

  if (wtPath) {
    const rm = spawnSync("git", ["-C", target, "worktree", "remove", wtPath], {
      stdio: "inherit",
    });
    if (rm.status !== 0) {
      return fail(
        `merged, but 'git worktree remove ${wtPath}' failed (uncommitted ` +
          `changes there?). Clean it up by hand, or re-run with --keep.`,
      );
    }
    out(`  removed worktree ${wtPath}\n`);
  }

  const del = spawnSync("git", ["-C", target, "branch", "-d", branch], {
    stdio: "inherit",
  });
  if (del.status !== 0) {
    return fail(
      `merged and removed the worktree, but 'git branch -d ${branch}' failed. ` +
        `Delete the branch by hand.`,
    );
  }
  out(`  deleted branch ${branch}\n\nDone.\n`);
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
      keep: {
        kind: "boolean",
        brief: "Keep the worktree and branch after a clean merge",
        default: false,
      },
      claude: {
        kind: "boolean",
        brief:
          "On conflict, launch claude to resolve (use --no-claude to skip)",
        default: true,
      },
    },
  },
  docs: {
    brief:
      "Merge a worktree branch into the current branch, then remove it " +
      "(claude resolves conflicts)",
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
    list: worktreeListCommand,
  },
  docs: {
    brief: "Manage git worktrees with project-specific bootstrap",
  },
});
