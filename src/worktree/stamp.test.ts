import { parse } from "yaml";

import { describe, expect, it } from "vitest";

import { stampWorktree } from "./stamp.js";

describe("stampWorktree", () => {
  it("creates the worktree block in an empty file", () => {
    const out = stampWorktree("", { name: "feature-x", port: 8001 });
    expect(parse(out)).toEqual({
      worktree: { name: "feature-x", port: 8001 },
    });
  });

  it("omits the port key when the port is 0 (main / feature off)", () => {
    const out = stampWorktree("", { name: "feature-x", port: 0 });
    expect(parse(out)).toEqual({ worktree: { name: "feature-x" } });
  });

  it("adds name + port into an existing worktree block, preserving other keys", () => {
    const existing = [
      "worktree:",
      "  dir: ../wt",
      "  setup:",
      "    - poetry install",
      "",
    ].join("\n");
    const parsed = parse(
      stampWorktree(existing, { name: "bugfix", port: 8002 }),
    ) as {
      worktree: Record<string, unknown>;
    };
    expect(parsed.worktree.name).toBe("bugfix");
    expect(parsed.worktree.port).toBe(8002);
    expect(parsed.worktree.dir).toBe("../wt");
    expect(parsed.worktree.setup).toEqual(["poetry install"]);
  });

  it("overwrites a previous name and port", () => {
    const out = stampWorktree("worktree:\n  name: old\n  port: 8000\n", {
      name: "new",
      port: 8005,
    });
    const wt = (parse(out) as { worktree: { name: string; port: number } })
      .worktree;
    expect(wt.name).toBe("new");
    expect(wt.port).toBe(8005);
  });

  it("preserves comments and unrelated top-level keys", () => {
    const existing = "# my config\nworktree:\n  dir: ../wt # here\n";
    const out = stampWorktree(existing, { name: "x", port: 8001 });
    expect(out).toContain("# my config");
    expect(out).toContain("# here");
  });
});
