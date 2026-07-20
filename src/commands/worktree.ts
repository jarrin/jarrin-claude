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

import type { CaddyTarget } from "../caddy/resolve.js";
import { resolveTarget } from "../caddy/resolve.js";
import { PROJECT_CADDY_PORT } from "../caddy/route.js";
import { deregisterTarget, registerTarget } from "../caddy/sync.js";
import { LOCAL_FILE, loadEffectiveConfig } from "../config/load.js";
import { parseConfig } from "../config/read.js";
import type { LocalContext } from "../context.js";
import {
  branchExists,
  conflictedFiles,
  currentBranch,
  headCommit,
  mainWorktreeRoot,
  toplevel,
  worktreeListPorcelain,
} from "../git.js";
import { runHooks, worktreeHookEnv } from "../hooks/run.js";
import { conflictPrompt, worktreePathForBranch } from "../worktree/merge.js";
import { removeWorktree } from "../worktree/remove.js";
import {
  nextPort,
  planWorktree,
  validateWorktreeName,
} from "../worktree/plan.js";
import { stampWorktree } from "../worktree/stamp.js";

interface CreateFlags {
  readonly setup: boolean;
  readonly hooks: boolean;
}

/**
 * `claudjar worktree create <name>` — add a git worktree and bootstrap it from
 * the merged `worktree:` config: create the branch, copy gitignored files across
 * (always `.jarrin.local.yml`, stamped with the worktree's identity), then run
 * the configured setup commands (poetry, docker, …) in the new worktree.
 *
 * Everything except the base directory is keyed on the worktree the command runs
 * in ("current"), not the main checkout: the new branch is cut from the current
 * HEAD, gitignored files are copied from here, and the current worktree's stamped
 * name prefixes the new one (`create x` in `dev` → `dev-x`). Only the base dir
 * resolves against the main root, which keeps the worktree folder flat however
 * long the chain gets. From the main checkout current === main, so a create there
 * behaves exactly as it always has.
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

  const mainRoot = mainWorktreeRoot(proc.cwd());
  const currentRoot = toplevel(proc.cwd());
  if (!mainRoot || !currentRoot) return fail("not inside a git repository.");

  // Config comes from the current worktree: its copy list, setup recipe, and —
  // crucially — its stamped identity, which becomes the new worktree's prefix.
  const cfg = loadEffectiveConfig(join(currentRoot, ".claude")).merged;
  const plan = planWorktree({
    name: name.trim(),
    parent: cfg.worktree.name,
    mainRoot,
    cfg: cfg.worktree,
  });
  const branch = plan.branch;

  if (existsSync(plan.path)) {
    return fail(`target already exists: ${plan.path}`);
  }

  // 1. Create the worktree, branching from the CURRENT worktree's HEAD. The
  //    start point is passed explicitly as a SHA because `worktree add` runs in
  //    the main root, where a bare HEAD would mean the main checkout's commit.
  const exists = branchExists(mainRoot, branch);
  const from = currentBranch(currentRoot);
  const startPoint = headCommit(currentRoot);
  const gitArgs = exists
    ? ["-C", mainRoot, "worktree", "add", plan.path, branch]
    : [
        "-C",
        mainRoot,
        "worktree",
        "add",
        "-b",
        branch,
        plan.path,
        // No start point in a repo without commits — let git use its default.
        ...(startPoint ? [startPoint] : []),
      ];
  const basedOn = exists
    ? "existing branch"
    : `branched from ${from ?? "HEAD"}`;
  out(`Creating worktree ${plan.path} (branch ${branch}, ${basedOn})…\n`);
  const add = spawnSync("git", gitArgs, { stdio: "inherit" });
  if (add.status !== 0) return fail("`git worktree add` failed.");

  // 2. Carry gitignored files across (env, local settings, local config) from
  //    the current worktree, so they match the code the branch was cut from.
  for (const rel of plan.copy) {
    const src = join(currentRoot, rel);
    if (!existsSync(src)) continue;
    const dest = join(plan.path, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
    out(`  copied ${rel}\n`);
  }

  // 3. Assign this worktree a PROJECT_PORT: one past the highest already handed
  //    out to a sibling worktree, never below the project's starting port. Only
  //    linked worktrees carry a port — the main checkout is never assigned one.
  //    Scanned from the main root, since the port space is repo-wide.
  const port =
    cfg.project.port > 0
      ? nextPort(cfg.project.port, assignedPorts(mainRoot))
      : 0;

  // 4. Stamp the worktree's identity (name + port) into its own .jarrin.local.yml
  //    so the todo / staged-planning skills can scope forge work to it and the
  //    session lifecycle hooks know its PROJECT_PORT.
  const localPath = join(plan.path, ".claude", LOCAL_FILE);
  const existing = existsSync(localPath) ? readFileSync(localPath, "utf8") : "";
  mkdirSync(dirname(localPath), { recursive: true });
  writeFileSync(
    localPath,
    stampWorktree(existing, { name: branch, port }),
    "utf8",
  );
  out(`  stamped worktree.name: ${branch} in .claude/${LOCAL_FILE}\n`);
  if (port > 0) out(`  assigned PROJECT_PORT: ${String(port)}\n`);

  // 5. Run setup commands in the new worktree, in order; stop on the first fail.
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

  // 6. Fire the committed create hooks in the new worktree. These run AFTER
  //    setup: setup is the machine-local bootstrap (deps for this machine),
  //    hooks are shared project policy that assumes a bootstrapped tree.
  //    They also get the SOURCE worktree — the one this command ran in, which
  //    the branch was cut from — so a hook can carry state forward into the new
  //    one (see `worktreeHookEnv`).
  const createHooks = flags.hooks ? cfg.hooks.worktree.create : [];
  if (createHooks.length > 0) {
    out(`Running hooks.worktree.create (${String(createHooks.length)})…\n`);
    const outcome = runHooks(
      createHooks,
      {
        cwd: plan.path,
        env: worktreeHookEnv(
          { name: branch, path: plan.path, port },
          {
            name: cfg.worktree.name,
            path: currentRoot,
            port: cfg.worktree.port,
          },
        ),
      },
      proc,
      out,
    );
    if (!outcome.ok && outcome.failed) {
      return fail(
        `create hook failed (exit ${String(outcome.failed.status)}): ` +
          `${outcome.failed.command}\n` +
          `The worktree exists at ${plan.path}; fix and re-run the hook by hand.`,
      );
    }
  }

  // 7. Give the new worktree its own <worktree>.<slug>.localhost route. Resolved
  //    from the worktree's OWN merged config — it was just stamped, so this is
  //    where its identity actually lives — and only when the project opted in.
  const wtCfg = loadEffectiveConfig(join(plan.path, ".claude")).merged;
  const target = resolveTarget(wtCfg, plan.path);
  if (target?.enabled) {
    const sync = registerTarget(this.caddyDir, target.entry);
    out(`  registered caddy route: ${target.hosts[0] ?? ""}\n`);
    out(
      `    → ${target.entry.upstream}:${String(PROJECT_CADDY_PORT)} ` +
        `(this worktree's own caddy must answer to that name)\n`,
    );
    if (sync.error)
      proc.stderr.write(`  ! caddy reload failed: ${sync.error}\n`);
  }

  out(`\nDone. cd ${relative(proc.cwd(), plan.path) || plan.path}\n`);
}

/**
 * Read a worktree's caddy identity from its own config — necessarily *before*
 * the directory is deleted, since afterwards there is nothing left to read.
 *
 * `enabled` is ignored on the removal path: a worktree that registered while
 * caddy was on must still be able to deregister after it was turned off, or the
 * route would outlive the worktree with nothing able to retire it.
 */
function caddyTargetAt(wtPath: string): CaddyTarget | null {
  if (!existsSync(join(wtPath, ".claude"))) return null;
  return resolveTarget(
    loadEffectiveConfig(join(wtPath, ".claude")).merged,
    wtPath,
  );
}

/** Retire a captured route after its worktree is gone. Silent when unregistered. */
function dropCaddyRoute(
  ctx: LocalContext,
  target: CaddyTarget | null,
  out: (msg: string) => void,
): void {
  if (!target) return;
  const sync = deregisterTarget(
    ctx.caddyDir,
    target.entry.slug,
    target.entry.worktree,
  );
  if (!sync.changed) return;
  out(`  deregistered caddy route: ${target.hosts[0] ?? ""}\n`);
  if (sync.error)
    ctx.process.stderr.write(`  ! caddy reload failed: ${sync.error}\n`);
}

/**
 * PROJECT_PORTs already assigned to this repo's linked worktrees, read from each
 * worktree's stamped `.jarrin.local.yml`. Drives the incrementing assignment in
 * {@link nextPort}; the main worktree carries no port and contributes nothing.
 */
function assignedPorts(repoRoot: string): number[] {
  const porcelain = worktreeListPorcelain(repoRoot);
  if (!porcelain) return [];
  const ports: number[] = [];
  for (const line of porcelain.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const wtPath = line.slice("worktree ".length).trim();
    const localPath = join(wtPath, ".claude", LOCAL_FILE);
    if (!existsSync(localPath)) continue;
    try {
      const port = parseConfig(readFileSync(localPath, "utf8")).worktree.port;
      if (port > 0) ports.push(port);
    } catch {
      // Unreadable local config — skip; a fresh port is still safe to hand out.
    }
  }
  return ports;
}

interface MergeFlags {
  readonly remove: boolean;
  readonly teardown: boolean;
  readonly claude: boolean;
  readonly hooks: boolean;
}

/**
 * `claudjar worktree merge <name>` — merge worktree branch `<name>` into the
 * branch checked out where the command runs, then tear the worktree down.
 *
 * Merging **keeps** the worktree and branch by default — folding work into the
 * parent is not the same as being done with the worktree, and you often merge
 * several times before the branch's life ends. Pass `--remove` to clean up in the
 * same step, which tears the worktree's project stack down first (`--no-teardown`
 * to skip that) — the same path `worktree remove` takes.
 *
 * On a conflict it keeps everything regardless and hands off to an interactive
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

  if (!flags.remove) {
    out(
      `Kept the worktree and branch. Pass --remove to clean up, or run ` +
        `'claudjar worktree remove ${branch}' later.\n`,
    );
    return;
  }

  if (!wtPath) {
    // The branch merged but has no worktree checked out — nothing to remove but
    // the branch itself, which the shared path handles via a safe delete.
    out(`  no worktree checked out for ${branch}\n`);
  }

  const caddyTarget = wtPath ? caddyTargetAt(wtPath) : null;
  const result = removeWorktree(
    {
      gitRoot: target,
      branch,
      wtPath: wtPath ?? "",
      teardown: flags.teardown && wtPath !== null,
      hooks: flags.hooks,
    },
    proc,
    out,
  );
  if (!result.ok) return fail(`merged, but ${result.error}`);
  dropCaddyRoute(this, caddyTarget, out);
  if (result.hookError)
    return fail(`merged and removed, but ${result.hookError}`);
  out(`\nDone.\n`);
}

interface RemoveFlags {
  readonly teardown: boolean;
  readonly hooks: boolean;
}

/**
 * `claudjar worktree remove <name>` — retire a worktree without merging it: tear
 * its project stack down (unless `--no-teardown`), remove the directory, and
 * safely delete the branch.
 *
 * The branch is deleted with `git branch -d`, so unmerged work is never discarded
 * silently — the branch simply survives and is reported. This is the counterpart
 * to `worktree create`, and the same path `worktree merge --remove` runs.
 */
function runWorktreeRemove(
  this: LocalContext,
  flags: RemoveFlags,
  name: string,
): void {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);
  const fail = (msg: string): void => {
    proc.stderr.write(`worktree remove: ${msg}\n`);
    proc.exitCode = 1;
  };

  const nameError = validateWorktreeName(name);
  if (nameError) return fail(nameError);
  const branch = name.trim();

  // Resolve from the main root so this works identically from the main checkout
  // and from any sibling worktree.
  const mainRoot = mainWorktreeRoot(proc.cwd());
  const currentRoot = toplevel(proc.cwd());
  if (!mainRoot || !currentRoot) return fail("not inside a git repository.");

  const porcelain = worktreeListPorcelain(mainRoot);
  const wtPath = porcelain ? worktreePathForBranch(porcelain, branch) : null;
  if (!wtPath) return fail(`no worktree checked out for branch '${branch}'.`);

  // Removing the ground you are standing on would leave the shell in a deleted
  // directory (and git refuses anyway) — say so plainly instead.
  if (resolve(wtPath) === resolve(currentRoot)) {
    return fail(
      `you are inside the worktree for '${branch}'; run this from another ` +
        `worktree (e.g. 'claudjar goto main' first).`,
    );
  }

  out(`Removing worktree ${wtPath} (branch ${branch})…\n`);
  const caddyTarget = caddyTargetAt(wtPath);
  const result = removeWorktree(
    {
      gitRoot: mainRoot,
      branch,
      wtPath,
      teardown: flags.teardown,
      hooks: flags.hooks,
    },
    proc,
    out,
  );
  if (!result.ok) return fail(result.error);
  dropCaddyRoute(this, caddyTarget, out);
  if (result.hookError) return fail(`removed, but ${result.hookError}`);
  out(`\nDone.\n`);
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
      claude: {
        kind: "boolean",
        brief:
          "On conflict, launch claude to resolve (use --no-claude to skip)",
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
      "Merge a worktree branch into the current branch, keeping the worktree " +
      "(claude resolves conflicts)",
    fullDescription:
      "Run from the worktree you want to merge INTO (e.g. main), naming the " +
      "branch to pull in.\n\n" +
      "The worktree and branch are KEPT by default — merging work up is not the " +
      "same as being finished with the worktree. Add --remove to clean up in the " +
      "same step: that stops the worktree's project stack, removes the directory, " +
      "and safely deletes the branch (--no-teardown leaves the stack running).\n\n" +
      "On a conflict nothing is removed: the worktree and branch stay put and an " +
      "interactive claude session opens in the target, seeded with both sides and " +
      "the conflicted paths. --no-claude prints the paths instead.",
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
