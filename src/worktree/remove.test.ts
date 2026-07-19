import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { removeWorktree } from "./remove.js";

let repo: string;
let out: string[];
let savedGitEnv: Record<string, string | undefined>;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
}

/** A repo with one commit on `main` — the substrate for worktree tests. */
beforeEach(() => {
  // Git hooks export GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE pointing at the
  // repo being committed to. Those win over `-C`, so without this the suite
  // passes standalone and fails inside the pre-commit hook — and `removeWorktree`
  // itself shells out to git, so clearing the vars for the whole test is the only
  // fix that covers both it and the helpers above.
  savedGitEnv = {};
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("GIT_")) {
      savedGitEnv[key] = process.env[key];
      delete process.env[key];
    }
  }

  repo = mkdtempSync(join(tmpdir(), "claudjar-rm-"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "hello\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "init");
  out = [];
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  for (const [key, value] of Object.entries(savedGitEnv)) {
    if (value !== undefined) process.env[key] = value;
  }
});

const collect = (msg: string): void => void out.push(msg);

/** Add a worktree for a new branch and return its path. */
function addWorktree(branch: string): string {
  const path = join(repo, "..", `wt-${branch}-${String(process.pid)}`);
  git(repo, "worktree", "add", "-q", "-b", branch, path);
  return path;
}

/** Paths currently registered as worktrees. */
function worktreeCount(): number {
  return git(repo, "worktree", "list").trim().split("\n").length;
}

describe("removeWorktree", () => {
  it("removes the worktree and deletes a merged branch", () => {
    const path = addWorktree("feat");
    try {
      const result = removeWorktree(
        { gitRoot: repo, branch: "feat", wtPath: path, teardown: false },
        process,
        collect,
      );
      expect(result).toEqual({ ok: true, branchKept: false });
      expect(worktreeCount()).toBe(1);
      expect(git(repo, "branch", "--list", "feat").trim()).toBe("");
    } finally {
      rmSync(path, { recursive: true, force: true });
    }
  });

  it("keeps an unmerged branch rather than discarding the work", () => {
    const path = addWorktree("wip");
    writeFileSync(join(path, "new.txt"), "unmerged work\n");
    git(path, "add", "-A");
    git(path, "commit", "-qm", "wip");

    const result = removeWorktree(
      { gitRoot: repo, branch: "wip", wtPath: path, teardown: false },
      process,
      collect,
    );

    // The worktree goes; the branch survives because `git branch -d` refuses.
    expect(result).toEqual({ ok: true, branchKept: true });
    expect(worktreeCount()).toBe(1);
    expect(git(repo, "branch", "--list", "wip")).toContain("wip");
    expect(out.join("")).toContain("kept branch wip");
  });

  it("reports a failure when the worktree cannot be removed", () => {
    const result = removeWorktree(
      {
        gitRoot: repo,
        branch: "feat",
        wtPath: join(repo, "nope"),
        teardown: false,
      },
      process,
      collect,
    );
    expect(result.ok).toBe(false);
  });
});
