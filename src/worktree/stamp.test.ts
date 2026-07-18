import { parse } from "yaml";

import { describe, expect, it } from "vitest";

import { stampWorktreeName } from "./stamp.js";

describe("stampWorktreeName", () => {
  it("creates the worktree block in an empty file", () => {
    const out = stampWorktreeName("", "feature-x");
    expect(parse(out)).toEqual({ worktree: { name: "feature-x" } });
  });

  it("adds name into an existing worktree block, preserving other keys", () => {
    const existing = [
      "worktree:",
      "  dir: ../wt",
      "  setup:",
      "    - poetry install",
      "",
    ].join("\n");
    const parsed = parse(stampWorktreeName(existing, "bugfix")) as {
      worktree: Record<string, unknown>;
    };
    expect(parsed.worktree.name).toBe("bugfix");
    expect(parsed.worktree.dir).toBe("../wt");
    expect(parsed.worktree.setup).toEqual(["poetry install"]);
  });

  it("overwrites a previous name", () => {
    const out = stampWorktreeName("worktree:\n  name: old\n", "new");
    expect((parse(out) as { worktree: { name: string } }).worktree.name).toBe(
      "new",
    );
  });

  it("preserves comments and unrelated top-level keys", () => {
    const existing = "# my config\nworktree:\n  dir: ../wt # here\n";
    const out = stampWorktreeName(existing, "x");
    expect(out).toContain("# my config");
    expect(out).toContain("# here");
  });
});
