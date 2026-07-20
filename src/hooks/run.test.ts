import { describe, expect, it } from "vitest";

import { worktreeHookEnv } from "./run.js";

describe("worktreeHookEnv", () => {
  it("exposes the worktree's own identity", () => {
    expect(
      worktreeHookEnv({ name: "dev", path: "/repo-worktrees/dev", port: 8001 }),
    ).toEqual({
      WORKTREE_NAME: "dev",
      WORKTREE_PATH: "/repo-worktrees/dev",
      PROJECT_PORT: "8001",
    });
  });

  it("omits the SOURCE_* keys when no source is given (remove hooks)", () => {
    const env = worktreeHookEnv({ name: "dev", path: "/gone", port: 8001 });
    expect(Object.keys(env)).not.toContain("SOURCE_WORKTREE_NAME");
  });

  it("adds the source worktree on create", () => {
    expect(
      worktreeHookEnv(
        { name: "dev-gwm", path: "/repo-worktrees/dev-gwm", port: 8002 },
        { name: "dev", path: "/repo-worktrees/dev", port: 8001 },
      ),
    ).toEqual({
      WORKTREE_NAME: "dev-gwm",
      WORKTREE_PATH: "/repo-worktrees/dev-gwm",
      PROJECT_PORT: "8002",
      SOURCE_WORKTREE_NAME: "dev",
      SOURCE_WORKTREE_PATH: "/repo-worktrees/dev",
      SOURCE_PROJECT_PORT: "8001",
    });
  });

  it("reports the main checkout as an unnamed, port-0 source", () => {
    const env = worktreeHookEnv(
      { name: "dev", path: "/repo-worktrees/dev", port: 8001 },
      { name: "", path: "/repo", port: 0 },
    );
    expect(env.SOURCE_WORKTREE_NAME).toBe("");
    expect(env.SOURCE_PROJECT_PORT).toBe("0");
    expect(env.SOURCE_WORKTREE_PATH).toBe("/repo");
  });
});
