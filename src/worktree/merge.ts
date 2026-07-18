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

/**
 * The prompt handed to an interactive `claude` session when a worktree merge
 * hits conflicts. Names both sides so Claude Code can resolve them in place.
 */
export function conflictPrompt(opts: {
  branch: string;
  targetBranch: string;
  files: readonly string[];
}): string {
  const list = opts.files.length
    ? opts.files.map((f) => `  - ${f}`).join("\n")
    : "  (none captured — run `git status` to see the conflicted paths)";
  return [
    `You are picking up a Git merge that is paused mid-conflict. There is no`,
    `earlier conversation — everything you need is below and in the repository`,
    `you have been started in.`,
    ``,
    `## What just happened`,
    ``,
    `This project used a separate git worktree for the branch '${opts.branch}'.`,
    `That work is now being merged back: 'git merge ${opts.branch}' was run while`,
    `'${opts.targetBranch}' was checked out, and Git stopped because the two sides`,
    `changed overlapping lines. The merge is IN PROGRESS — the working tree holds`,
    `conflict markers (<<<<<<<, =======, >>>>>>>) and MERGE_HEAD still exists.`,
    `Nothing has been committed or lost.`,
    ``,
    `## Conflicted files`,
    ``,
    list,
    ``,
    `## Your job`,
    ``,
    `1. Run 'git status' and 'git diff' to see the full picture; open each`,
    `   conflicted file and read the markers. The '${opts.targetBranch}' side is`,
    `   labelled HEAD / "ours"; the incoming '${opts.branch}' side is "theirs".`,
    `2. Resolve every conflict by UNDERSTANDING both changes and combining their`,
    `   intent — do not blindly pick one side, and never delete a marker without`,
    `   deciding what the merged code should actually be. Read the surrounding`,
    `   code so the result is coherent, not just marker-free.`,
    `3. Remove all conflict markers. Make sure the file still parses and the`,
    `   change reads like the rest of the codebase.`,
    `4. Stage each resolved file with 'git add <file>'. When 'git status' shows no`,
    `   remaining unmerged paths, finish the merge with 'git commit --no-edit'`,
    `   (keep the default merge message).`,
    `5. Verify: run this repo's checks and fix anything that breaks BEFORE you`,
    `   call it done — look for the project's gate (e.g. 'pnpm check', 'pnpm test',`,
    `   'composer check', 'poetry run pytest', a Makefile target, or the commands`,
    `   in its README / CLAUDE.md) and run it.`,
    ``,
    `## Rules`,
    ``,
    `- Do NOT run 'git merge --abort' or 'git reset' — that throws the merge away.`,
    `- Do NOT force-push or rewrite history.`,
    `- If a conflict is genuinely ambiguous and you cannot determine the right`,
    `  resolution from the code, stop and explain the specific decision you need`,
    `  rather than guessing.`,
    `- When finished, summarise what conflicted and how you resolved each one.`,
  ].join("\n");
}
