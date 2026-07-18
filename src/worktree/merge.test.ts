import { describe, expect, it } from "vitest";

import {
  conflictPrompt,
  parseWorktreeList,
  worktreePathForBranch,
} from "./merge.js";

const PORCELAIN = [
  "worktree /home/j/Projects/app",
  "HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "branch refs/heads/main",
  "",
  "worktree /home/j/Projects/app-worktrees/feature-x",
  "HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "branch refs/heads/feature/x",
  "",
  "worktree /home/j/Projects/app-worktrees/detached",
  "HEAD cccccccccccccccccccccccccccccccccccccccc",
  "detached",
  "",
].join("\n");

describe("parseWorktreeList", () => {
  it("splits records and strips the refs/heads/ prefix", () => {
    const entries = parseWorktreeList(PORCELAIN);
    expect(entries).toEqual([
      { path: "/home/j/Projects/app", branch: "main" },
      { path: "/home/j/Projects/app-worktrees/feature-x", branch: "feature/x" },
      { path: "/home/j/Projects/app-worktrees/detached", branch: null },
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseWorktreeList("")).toEqual([]);
  });
});

describe("worktreePathForBranch", () => {
  it("finds the worktree checking out a branch (slash names included)", () => {
    expect(worktreePathForBranch(PORCELAIN, "feature/x")).toBe(
      "/home/j/Projects/app-worktrees/feature-x",
    );
  });

  it("returns null when no worktree has the branch", () => {
    expect(worktreePathForBranch(PORCELAIN, "nope")).toBeNull();
  });
});

describe("conflictPrompt", () => {
  it("names both branches and lists the conflicted files", () => {
    const p = conflictPrompt({
      branch: "feature/x",
      targetBranch: "main",
      files: ["src/a.ts", "src/b.ts"],
    });
    expect(p).toContain("branch 'feature/x'");
    expect(p).toContain("'git merge feature/x' was run while");
    expect(p).toContain("'main' was checked out");
    expect(p).toContain("  - src/a.ts");
    expect(p).toContain("  - src/b.ts");
    expect(p).toContain("Do NOT run 'git merge --abort'");
    expect(p).toContain("git commit --no-edit");
  });

  it("falls back to a git status hint when no files are given", () => {
    const p = conflictPrompt({ branch: "x", targetBranch: "main", files: [] });
    expect(p).toContain("run `git status`");
  });
});
