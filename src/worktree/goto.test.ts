import { describe, expect, it } from "vitest";

import { availableNames, resolveGotoTarget } from "./goto.js";
import { parseWorktreeList } from "./merge.js";

const PORCELAIN = [
  "worktree /home/j/Projects/app",
  "HEAD abc123",
  "branch refs/heads/main",
  "",
  "worktree /home/j/Projects/app-worktrees/feature/x",
  "HEAD def456",
  "branch refs/heads/feature/x",
  "",
  "worktree /home/j/Projects/app-worktrees/bugfix",
  "HEAD 789abc",
  "branch refs/heads/bugfix",
  "",
].join("\n");

describe("resolveGotoTarget", () => {
  it("resolves a linked worktree by branch name", () => {
    const target = resolveGotoTarget(
      PORCELAIN,
      "bugfix",
      "/home/j/Projects/app",
    );
    expect(target).toEqual({
      ok: true,
      path: "/home/j/Projects/app-worktrees/bugfix",
      name: "bugfix",
    });
  });

  it("resolves a slashed branch name", () => {
    const target = resolveGotoTarget(
      PORCELAIN,
      "feature/x",
      "/home/j/Projects/app",
    );
    expect(target).toEqual({
      ok: true,
      path: "/home/j/Projects/app-worktrees/feature/x",
      name: "feature/x",
    });
  });

  it("falls back to the directory basename", () => {
    // `goto x` reaches the worktree created as `feature/x`.
    const target = resolveGotoTarget(PORCELAIN, "x", "/home/j/Projects/app");
    expect(target).toEqual({
      ok: true,
      path: "/home/j/Projects/app-worktrees/feature/x",
      name: "feature/x",
    });
  });

  it("prefers a branch match over a basename match", () => {
    const porcelain = [
      "worktree /home/j/Projects/app",
      "branch refs/heads/main",
      "",
      // Directory basename 'b', branch 'a' — and vice versa.
      "worktree /home/j/Projects/wt/b",
      "branch refs/heads/a",
      "",
      "worktree /home/j/Projects/wt/a",
      "branch refs/heads/b",
      "",
    ].join("\n");
    const target = resolveGotoTarget(porcelain, "a", "/home/j/Projects/app");
    expect(target).toMatchObject({ ok: true, path: "/home/j/Projects/wt/b" });
  });

  it("resolves 'main' to the first (main) worktree, not a linked one", () => {
    const target = resolveGotoTarget(PORCELAIN, "main", "/ignored");
    expect(target).toEqual({
      ok: true,
      path: "/home/j/Projects/app",
      name: "main",
    });
  });

  it("accepts 'main' case-insensitively and with surrounding space", () => {
    for (const name of ["MAIN", " Main "]) {
      expect(resolveGotoTarget(PORCELAIN, name, "/ignored")).toMatchObject({
        ok: true,
        path: "/home/j/Projects/app",
      });
    }
  });

  it("falls back to the given root when the porcelain is empty", () => {
    const target = resolveGotoTarget("", "main", "/home/j/Projects/app");
    expect(target).toEqual({
      ok: true,
      path: "/home/j/Projects/app",
      name: "main",
    });
  });

  it("never resolves a bare name to the main worktree", () => {
    // 'app' is the main checkout's basename — it must not be reachable except
    // through the reserved 'main' name.
    const target = resolveGotoTarget(PORCELAIN, "app", "/home/j/Projects/app");
    expect(target.ok).toBe(false);
  });

  it("reports the available names on a miss", () => {
    const target = resolveGotoTarget(PORCELAIN, "nope", "/home/j/Projects/app");
    expect(target).toEqual({
      ok: false,
      available: ["main", "feature/x", "bugfix"],
    });
  });

  it("trims the requested name", () => {
    expect(resolveGotoTarget(PORCELAIN, "  bugfix  ", "/x")).toMatchObject({
      ok: true,
      name: "bugfix",
    });
  });

  it("names a detached worktree by its directory", () => {
    const porcelain = [
      "worktree /home/j/Projects/app",
      "branch refs/heads/main",
      "",
      "worktree /home/j/Projects/app-worktrees/detached",
      "detached",
      "",
    ].join("\n");
    expect(resolveGotoTarget(porcelain, "detached", "/x")).toMatchObject({
      ok: true,
      path: "/home/j/Projects/app-worktrees/detached",
      name: "detached",
    });
  });
});

describe("availableNames", () => {
  it("lists main plus every linked worktree", () => {
    const linked = parseWorktreeList(PORCELAIN).slice(1);
    expect(availableNames(linked)).toEqual(["main", "feature/x", "bugfix"]);
  });

  it("lists just main when there are no linked worktrees", () => {
    expect(availableNames([])).toEqual(["main"]);
  });
});
