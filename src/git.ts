import { spawnSync } from "node:child_process";
import { dirname } from "node:path";

/** Run `git` with args in `cwd`; return trimmed stdout, or null on failure. */
function git(cwd: string, args: string[]): string | null {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (r.status === 0 && typeof r.stdout === "string" && r.stdout.trim()) {
    return r.stdout.trim();
  }
  return null;
}

/** The current worktree's top-level directory, or null when not in a repo. */
export function toplevel(cwd: string): string | null {
  return git(cwd, ["rev-parse", "--show-toplevel"]);
}

/**
 * The **main** worktree's root, regardless of which linked worktree `cwd` is in.
 * Derived from the common git dir (`<main>/.git`) so `worktree create` always
 * groups new worktrees relative to the main checkout, and reads config/copy
 * sources from it. Falls back to the current toplevel.
 */
export function mainWorktreeRoot(cwd: string): string | null {
  const common = git(cwd, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  if (common) return dirname(common);
  return toplevel(cwd);
}

/** True when a local branch with this exact name already exists. */
export function branchExists(cwd: string, name: string): boolean {
  return (
    git(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]) !==
    null
  );
}

/** Short name of the branch checked out at `cwd` (e.g. `main`), or null. */
export function currentBranch(cwd: string): string | null {
  return git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

/**
 * The commit `cwd`'s worktree has checked out, as a full SHA — the start point a
 * new branch is cut from. A SHA rather than `HEAD` or a branch name because
 * `worktree add` runs with `-C <mainRoot>`, where `HEAD` would mean the *main*
 * checkout's commit, not this worktree's. Null in a repo with no commits yet.
 */
export function headCommit(cwd: string): string | null {
  return git(cwd, ["rev-parse", "HEAD"]);
}

/**
 * Working-tree changes as `git status --porcelain` lines (staged, unstaged, and
 * untracked). Empty means clean — which is what `release` requires before it
 * commits and tags.
 */
export function statusPorcelain(cwd: string): string[] {
  const r = spawnSync("git", ["-C", cwd, "status", "--porcelain"], {
    encoding: "utf8",
  });
  if (r.status !== 0 || typeof r.stdout !== "string") return [];
  return r.stdout
    .split("\n")
    .map((s) => s.trimEnd())
    .filter(Boolean);
}

/** All tag names in the repo. Empty in a repo with no tags (or on failure). */
export function listTags(cwd: string): string[] {
  const out = git(cwd, ["tag", "--list"]);
  if (!out) return [];
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Raw `git worktree list --porcelain` output for `cwd`, or null on failure. */
export function worktreeListPorcelain(cwd: string): string | null {
  return git(cwd, ["worktree", "list", "--porcelain"]);
}

/**
 * Paths of files left unmerged (conflicted) in `cwd`'s working tree. Empty when
 * there is no conflict — used to tell a merge conflict apart from other failures.
 */
export function conflictedFiles(cwd: string): string[] {
  const r = spawnSync(
    "git",
    ["-C", cwd, "diff", "--name-only", "--diff-filter=U"],
    { encoding: "utf8" },
  );
  if (r.status !== 0 || typeof r.stdout !== "string") return [];
  return r.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
