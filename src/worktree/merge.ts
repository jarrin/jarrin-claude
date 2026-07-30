/**
 * Pure helpers for `claudjar worktree merge` — parsing `git worktree list`
 * output and composing the conflict-handoff prompt. No filesystem or git access;
 * the imperative git/spawn steps live in `commands/worktree.ts`.
 */

/** One record from `git worktree list --porcelain`. */
export interface WorktreeEntry {
  /** Absolute worktree path. */
  readonly path: string;
  /** Short branch name checked out there, or null when detached / bare. */
  readonly branch: string | null;
}

/**
 * Parse `git worktree list --porcelain`. Records are blank-line separated; each
 * opens with a `worktree <path>` line and may carry a `branch refs/heads/<name>`
 * line (absent for a detached or bare worktree).
 */
export function parseWorktreeList(porcelain: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let path: string | null = null;
  let branch: string | null = null;
  const flush = (): void => {
    if (path) entries.push({ path, branch });
    path = null;
    branch = null;
  };
  for (const raw of porcelain.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("worktree ")) {
      flush();
      path = line.slice("worktree ".length);
    } else if (line.startsWith("branch ")) {
      branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (line === "") {
      flush();
    }
  }
  flush();
  return entries;
}

/** Absolute path of the worktree checking out `branch`, or null if none does. */
export function worktreePathForBranch(
  porcelain: string,
  branch: string,
): string | null {
  return (
    parseWorktreeList(porcelain).find((e) => e.branch === branch)?.path ?? null
  );
}
