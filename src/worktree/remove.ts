import { spawnSync } from "node:child_process";

import { PORT_ENV, stopStackAt } from "../project/stack.js";

/** What {@link removeWorktree} was asked to do. */
export interface RemoveRequest {
  /** Repo root the git commands run against (any worktree of the repo). */
  readonly gitRoot: string;
  /** Branch checked out in the worktree being removed. */
  readonly branch: string;
  /** Path of the worktree to remove. */
  readonly wtPath: string;
  /** Run the project stack's `exit` before removing the directory. */
  readonly teardown: boolean;
}

/** How far {@link removeWorktree} got, and why it stopped. */
export type RemoveResult =
  | { readonly ok: false; readonly error: string }
  | {
      readonly ok: true;
      /** Set when the branch survived a safe delete (i.e. it was unmerged). */
      readonly branchKept: boolean;
    };

/**
 * Tear down a worktree's project stack, remove the worktree, and safely delete
 * its branch. Shared by `worktree remove` and `worktree merge --remove` so both
 * paths clean up identically — the merge case just knows the branch is merged.
 *
 * Order matters: `exit` runs BEFORE `git worktree remove`, because the compose
 * file (and whatever else the command needs) lives inside the directory about to
 * be deleted. A failed teardown aborts before the removal rather than stranding
 * containers on a port whose stack file no longer exists.
 *
 * Branch deletion uses `git branch -d`, never `-D`: the safe delete succeeds
 * exactly when the branch is fully merged, so an unmerged branch survives and is
 * reported rather than silently discarded.
 */
export function removeWorktree(
  req: RemoveRequest,
  proc: NodeJS.Process,
  out: (msg: string) => void,
): RemoveResult {
  const { gitRoot, branch, wtPath, teardown } = req;

  if (teardown) {
    const torn = stopStackAt(wtPath, proc);
    if (torn) {
      out(
        `  stopped project stack on ${PORT_ENV}=${String(torn.port)}: ${torn.command}\n`,
      );
      if (torn.status !== 0) {
        return {
          ok: false,
          error:
            `stack teardown exited ${String(torn.status)} (\`${torn.command}\` in ` +
            `${wtPath}); the worktree is kept so you can clean up. Re-run once it ` +
            `is down, or pass --no-teardown to remove it anyway.`,
        };
      }
    }
  }

  const rm = spawnSync("git", ["-C", gitRoot, "worktree", "remove", wtPath], {
    stdio: "inherit",
  });
  if (rm.status !== 0) {
    return {
      ok: false,
      error:
        `'git worktree remove ${wtPath}' failed — see git's message above. It ` +
        `refuses on modified tracked files AND on untracked ones, so a common ` +
        `cause is a repo that never gitignored .claude/.jarrin.local.yml (which ` +
        `'worktree create' writes into every worktree). Ignored files do not ` +
        `block removal; commit, stash, or ignore what git names, then retry.`,
    };
  }
  out(`  removed worktree ${wtPath}\n`);

  // Safe delete only: this fails by design on an unmerged branch, which is the
  // signal that the work is not yet folded in anywhere.
  const del = spawnSync("git", ["-C", gitRoot, "branch", "-d", branch], {
    stdio: ["inherit", "inherit", "pipe"],
    encoding: "utf8",
  });
  if (del.status !== 0) {
    out(
      `  kept branch ${branch} (not fully merged — delete with ` +
        `'git branch -D ${branch}' if you meant to discard it)\n`,
    );
    return { ok: true, branchKept: true };
  }
  out(`  deleted branch ${branch}\n`);
  return { ok: true, branchKept: false };
}
