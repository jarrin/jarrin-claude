import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { CaddyTarget } from "../caddy/resolve.js";
import { resolveTarget } from "../caddy/resolve.js";
import { PROJECT_CADDY_PORT } from "../caddy/route.js";
import { deregisterTarget, registerTarget } from "../caddy/sync.js";
import { LOCAL_FILE, loadEffectiveConfig } from "../config/load.js";
import { parseConfig } from "../config/read.js";
import {
  branchExists,
  conflictedFiles,
  currentBranch,
  headCommit,
  mainWorktreeRoot,
  toplevel,
  worktreeListPorcelain,
} from "../git.js";
import type { HookIO } from "../hooks/run.js";
import { runHooks, worktreeHookEnv } from "../hooks/run.js";
import { worktreePathForBranch } from "./merge.js";
import { nextPort, planWorktree, validateWorktreeName } from "./plan.js";
import { retireWorktree } from "./remove.js";
import type { CommandRunner } from "./runner.js";
import { stampWorktree } from "./stamp.js";

/**
 * Worktree create / merge / remove as a library: callable with an explicit
 * repo root, driven through injected IO, and answering with a typed result.
 * The `claudjar worktree` CLI is a thin wrapper over these; the service calls
 * them directly for the web interface.
 *
 * `repoRoot` is the checkout the operation runs *from* — what the CLI's cwd
 * is. Any path inside a checkout works; it is resolved to that checkout's
 * root. Narration goes to `log` as it happens; the outcome is the return value.
 */

/** The IO a worktree operation runs through. No `process.*` is touched. */
export interface WorktreeDeps extends HookIO {
  readonly run: CommandRunner;
  /** Machine-wide caddy state dir (registry + Caddyfile). */
  readonly caddyDir: string;
}

export interface CreateOptions {
  /** Worktree / branch name; prefixed with the source worktree's own name. */
  readonly name: string;
  /** Run `worktree.setup` (default true). */
  readonly setup?: boolean;
  /** Run `hooks.worktree.create` (default true). */
  readonly hooks?: boolean;
  /** Milestone title to link the worktree to, stamped as `worktree.milestone`. */
  readonly milestone?: string;
}

export type CreateResult =
  | {
      readonly ok: true;
      /** The branch — also the stamped `worktree.name`. */
      readonly name: string;
      readonly path: string;
      /** Assigned PROJECT_PORT; 0 when the project declares no port. */
      readonly port: number;
      /** Stamped milestone title, or "" when not linked. */
      readonly milestone: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
      /** Set when the worktree was created before the failure and still exists. */
      readonly path: string | null;
    };

/**
 * Add a git worktree and bootstrap it from the merged `worktree:` config:
 * create the branch, copy gitignored files across, assign a PROJECT_PORT,
 * stamp the worktree's identity into its `.jarrin.local.yml`, run setup, then
 * the create hooks, and register its caddy route.
 *
 * Everything except the base directory is keyed on the worktree `repoRoot`
 * names ("current"), not the main checkout: the new branch is cut from the
 * current HEAD, gitignored files are copied from here, and the current
 * worktree's stamped name prefixes the new one (`create x` in `dev` → `dev-x`).
 * Only the base dir resolves against the main root, which keeps the worktree
 * folder flat however long the chain gets.
 */
export async function createWorktree(
  repoRoot: string,
  opts: CreateOptions,
  deps: WorktreeDeps,
): Promise<CreateResult> {
  const out = deps.log;
  const nameError = validateWorktreeName(opts.name);
  if (nameError) return { ok: false, error: nameError, path: null };

  const mainRoot = mainWorktreeRoot(repoRoot);
  const currentRoot = toplevel(repoRoot);
  if (!mainRoot || !currentRoot) {
    return { ok: false, error: "not inside a git repository.", path: null };
  }

  // Config comes from the current worktree: its copy list, setup recipe, and —
  // crucially — its stamped identity, which becomes the new worktree's prefix.
  const cfg = loadEffectiveConfig(join(currentRoot, ".claude")).merged;
  const plan = planWorktree({
    name: opts.name.trim(),
    parent: cfg.worktree.name,
    mainRoot,
    cfg: cfg.worktree,
  });
  const branch = plan.branch;
  const milestone = opts.milestone?.trim() ?? "";
  // Once the worktree exists, a later failure leaves it in place to fix by hand.
  const failAfter = (error: string): CreateResult => ({
    ok: false,
    error,
    path: plan.path,
  });

  if (existsSync(plan.path)) {
    return {
      ok: false,
      error: `target already exists: ${plan.path}`,
      path: null,
    };
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
  const add = await deps.run({ command: "git", args: gitArgs });
  if (add.status !== 0) {
    return { ok: false, error: "`git worktree add` failed.", path: null };
  }

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

  // 4. Stamp the worktree's identity (name + port, and the milestone it was
  //    created for) into its own .jarrin.local.yml so the todo / staged-planning
  //    skills can scope forge work to it and the stack knows its PROJECT_PORT.
  //    The copied file may carry the SOURCE's milestone; stamping without one
  //    clears it, so an unlinked worktree does not inherit the link.
  const localPath = join(plan.path, ".claude", LOCAL_FILE);
  const existing = existsSync(localPath) ? readFileSync(localPath, "utf8") : "";
  mkdirSync(dirname(localPath), { recursive: true });
  writeFileSync(
    localPath,
    stampWorktree(existing, { name: branch, port, milestone }),
    "utf8",
  );
  out(`  stamped worktree.name: ${branch} in .claude/${LOCAL_FILE}\n`);
  if (port > 0) out(`  assigned PROJECT_PORT: ${String(port)}\n`);
  if (milestone) out(`  linked milestone: ${milestone}\n`);

  // 5. Run setup commands in the new worktree, in order; stop on the first fail.
  const runSetup = opts.setup ?? true;
  if (runSetup && plan.setup.length > 0) {
    out(`Running setup (${String(plan.setup.length)} command(s))…\n`);
    for (const command of plan.setup) {
      out(`  $ ${command}\n`);
      const res = await deps.run({ command, cwd: plan.path });
      if (res.status !== 0) {
        return failAfter(
          `setup command failed (exit ${String(res.status)}): ${command}\n` +
            `The worktree exists at ${plan.path}; fix and re-run setup by hand.`,
        );
      }
    }
  } else if (!runSetup && plan.setup.length > 0) {
    out(
      `Skipped ${String(plan.setup.length)} setup command(s) (--no-setup).\n`,
    );
  }

  // 6. Fire the committed create hooks in the new worktree. These run AFTER
  //    setup: setup is the machine-local bootstrap (deps for this machine),
  //    hooks are shared project policy that assumes a bootstrapped tree.
  //    They also get the SOURCE worktree — the one this ran from, which the
  //    branch was cut from — so a hook can carry state forward into the new
  //    one (see `worktreeHookEnv`).
  const createHooks = (opts.hooks ?? true) ? cfg.hooks.worktree.create : [];
  if (createHooks.length > 0) {
    out(`Running hooks.worktree.create (${String(createHooks.length)})…\n`);
    const outcome = await runHooks(
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
      deps,
    );
    if (!outcome.ok && outcome.failed) {
      return failAfter(
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
    const sync = registerTarget(deps.caddyDir, target.entry);
    out(`  registered caddy route: ${target.hosts[0] ?? ""}\n`);
    out(
      `    → ${target.entry.upstream}:${String(PROJECT_CADDY_PORT)} ` +
        `(this worktree's own caddy must answer to that name)\n`,
    );
    if (sync.error) deps.warn(`  ! caddy reload failed: ${sync.error}\n`);
  }

  return { ok: true, name: branch, path: plan.path, port, milestone };
}

export interface MergeOptions {
  /** Worktree / branch name to merge in. */
  readonly name: string;
  /** After a clean merge, also remove the worktree (default false). */
  readonly remove?: boolean;
  /** With `remove`, stop the project stack first (default true). */
  readonly teardown?: boolean;
  /** With `remove`, run `hooks.worktree.remove` (default true). */
  readonly hooks?: boolean;
  /**
   * On a conflict, `git merge --abort` so the target is left as it was
   * (default false: the conflict stays in place for a person to resolve). The
   * service sets it — nobody is standing in that checkout to finish the merge.
   */
  readonly abortOnConflict?: boolean;
}

/** The cleanup half of a merge or a remove, when it went through. */
export interface Removal {
  readonly path: string | null;
  /** The branch survived its safe delete (it was unmerged). */
  readonly branchKept: boolean;
  /**
   * A `hooks.worktree.remove` command failed. The removal already happened and
   * is not undone, so this rides on a successful result rather than failing it.
   */
  readonly hookError: string | null;
}

export type MergeResult =
  | {
      readonly ok: true;
      /** The branch merged into, or null on a detached HEAD. */
      readonly into: string | null;
      /** Set when `remove` was asked for and went through. */
      readonly removal: Removal | null;
    }
  | {
      readonly ok: false;
      readonly error: string;
      /** Conflicted paths when the merge stopped on a conflict; else empty. */
      readonly conflicts: readonly string[];
    };

/**
 * Merge worktree branch `name` into the branch checked out at `repoRoot`.
 *
 * The worktree and branch are **kept** by default — folding work into the
 * parent is not the same as being done with it. With `remove`, a clean merge is
 * followed by the same teardown-then-remove path {@link removeWorktree} takes.
 * On a conflict everything is kept and the conflicted paths are returned; the
 * caller resolves them in place and commits.
 */
export async function mergeWorktree(
  repoRoot: string,
  opts: MergeOptions,
  deps: WorktreeDeps,
): Promise<MergeResult> {
  const out = deps.log;
  const fail = (error: string): MergeResult => ({
    ok: false,
    error,
    conflicts: [],
  });

  const nameError = validateWorktreeName(opts.name);
  if (nameError) return fail(nameError);
  const branch = opts.name.trim();

  // The merge lands in the worktree `repoRoot` names, not the main checkout —
  // you stand on `main` (or wherever) and pull the branch in.
  const target = toplevel(repoRoot);
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
  const merge = await deps.run({
    command: "git",
    args: ["-C", target, "merge", "--no-edit", branch],
  });

  if (merge.status !== 0) {
    const files = conflictedFiles(target);
    if (files.length === 0) {
      return fail("`git merge` failed (not a conflict); resolve and retry.");
    }
    if (opts.abortOnConflict ?? false) {
      const aborted = await deps.run({
        command: "git",
        args: ["-C", target, "merge", "--abort"],
      });
      return {
        ok: false,
        error:
          `conflict in ${String(files.length)} file(s); ` +
          (aborted.status === 0
            ? "the merge was aborted, nothing changed."
            : `\`git merge --abort\` failed too — ${target} is mid-merge.`),
        conflicts: files,
      };
    }
    return {
      ok: false,
      error:
        `conflict in ${String(files.length)} file(s); ` +
        `worktree and branch kept.`,
      conflicts: files,
    };
  }

  out(`Merged ${branch} cleanly.\n`);
  if (!(opts.remove ?? false))
    return { ok: true, into: onBranch, removal: null };

  if (!wtPath) {
    // The branch merged but has no worktree checked out — nothing to remove but
    // the branch itself, which the shared path handles via a safe delete.
    out(`  no worktree checked out for ${branch}\n`);
  }

  const caddyTarget = wtPath ? caddyTargetAt(wtPath) : null;
  const result = await retireWorktree(
    {
      gitRoot: target,
      branch,
      wtPath: wtPath ?? "",
      teardown: (opts.teardown ?? true) && wtPath !== null,
      hooks: opts.hooks ?? true,
    },
    deps,
  );
  if (!result.ok) return fail(`merged, but ${result.error}`);
  dropCaddyRoute(deps, caddyTarget);
  return {
    ok: true,
    into: onBranch,
    removal: {
      path: wtPath,
      branchKept: result.branchKept,
      hookError: result.hookError,
    },
  };
}

export interface RemoveOptions {
  /** Worktree / branch name to remove. */
  readonly name: string;
  /** Stop the worktree's project stack first (default true). */
  readonly teardown?: boolean;
  /** Run `hooks.worktree.remove` afterwards (default true). */
  readonly hooks?: boolean;
}

export type RemoveResult =
  | ({ readonly ok: true } & Removal)
  | { readonly ok: false; readonly error: string };

/**
 * Retire a worktree without merging it: tear its project stack down (unless
 * `teardown: false`), remove the directory, safely delete the branch, and drop
 * its caddy route.
 *
 * The branch is deleted with `git branch -d`, so unmerged work is never
 * discarded silently — the branch simply survives and is reported. Resolved
 * from the main root, so it works identically from any checkout of the repo
 * other than the worktree being removed.
 */
export async function removeWorktree(
  repoRoot: string,
  opts: RemoveOptions,
  deps: WorktreeDeps,
): Promise<RemoveResult> {
  const nameError = validateWorktreeName(opts.name);
  if (nameError) return { ok: false, error: nameError };
  const branch = opts.name.trim();

  const mainRoot = mainWorktreeRoot(repoRoot);
  const currentRoot = toplevel(repoRoot);
  if (!mainRoot || !currentRoot) {
    return { ok: false, error: "not inside a git repository." };
  }

  const porcelain = worktreeListPorcelain(mainRoot);
  const wtPath = porcelain ? worktreePathForBranch(porcelain, branch) : null;
  if (!wtPath) {
    return {
      ok: false,
      error: `no worktree checked out for branch '${branch}'.`,
    };
  }

  // Removing the ground you are standing on would leave the shell in a deleted
  // directory (and git refuses anyway) — say so plainly instead.
  if (resolve(wtPath) === resolve(currentRoot)) {
    return {
      ok: false,
      error:
        `you are inside the worktree for '${branch}'; run this from another ` +
        `worktree (e.g. 'claudjar goto main' first).`,
    };
  }

  deps.log(`Removing worktree ${wtPath} (branch ${branch})…\n`);
  const caddyTarget = caddyTargetAt(wtPath);
  const result = await retireWorktree(
    {
      gitRoot: mainRoot,
      branch,
      wtPath,
      teardown: opts.teardown ?? true,
      hooks: opts.hooks ?? true,
    },
    deps,
  );
  if (!result.ok) return result;
  dropCaddyRoute(deps, caddyTarget);
  return {
    ok: true,
    path: wtPath,
    branchKept: result.branchKept,
    hookError: result.hookError,
  };
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
function dropCaddyRoute(deps: WorktreeDeps, target: CaddyTarget | null): void {
  if (!target) return;
  const sync = deregisterTarget(
    deps.caddyDir,
    target.entry.slug,
    target.entry.worktree,
  );
  if (!sync.changed) return;
  deps.log(`  deregistered caddy route: ${target.hosts[0] ?? ""}\n`);
  if (sync.error) deps.warn(`  ! caddy reload failed: ${sync.error}\n`);
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
