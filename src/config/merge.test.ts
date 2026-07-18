import { describe, expect, it } from "vitest";

import { mergeConfig } from "./merge.js";
import { parseConfig } from "./read.js";
import { emptyConfig } from "./schema.js";

describe("mergeConfig", () => {
  it("takes non-worktree keys from base only, ignoring the local file", () => {
    const base = parseConfig(
      [
        "rules:",
        "  - lang-ts",
        "commands:",
        "  - cmd: pnpm check",
        "    desc: gates",
        "backup: git bundle create ../b --all",
        "",
      ].join("\n"),
    );
    // The local file tries to add rules/commands/backup — all must be ignored.
    const local = parseConfig(
      [
        "rules:",
        "  - lang-php",
        "commands:",
        "  - cmd: sneaky",
        "    desc: nope",
        "backup: rm -rf /",
        "",
      ].join("\n"),
    );

    const merged = mergeConfig(base, local);
    expect(merged.rules).toEqual(["lang-ts"]);
    expect(merged.commands).toEqual([{ cmd: "pnpm check", desc: "gates" }]);
    expect(merged.backup).toBe("git bundle create ../b --all");
  });

  it("overrides worktree.dir/name and unions copy, base first", () => {
    const base = parseConfig(
      [
        "worktree:",
        "  dir: ../base-wt",
        "  copy:",
        "    - .env",
        "  name: base",
        "",
      ].join("\n"),
    );
    const local = parseConfig(
      [
        "worktree:",
        "  dir: ../local-wt",
        "  copy:",
        "    - .env.local",
        "  name: feature-x",
        "",
      ].join("\n"),
    );

    const merged = mergeConfig(base, local);
    expect(merged.worktree.dir).toBe("../local-wt");
    expect(merged.worktree.name).toBe("feature-x");
    expect(merged.worktree.copy).toEqual([".env", ".env.local"]);
  });

  it("keeps base worktree values when local omits them", () => {
    const base = parseConfig("worktree:\n  dir: ../base-wt\n  name: base\n");
    const merged = mergeConfig(base, emptyConfig());
    expect(merged.worktree.dir).toBe("../base-wt");
    expect(merged.worktree.name).toBe("base");
  });

  it("replaces setup wholesale when local declares any command", () => {
    const base = parseConfig("worktree:\n  setup:\n    - poetry install\n");
    const local = parseConfig(
      "worktree:\n  setup:\n    - docker compose up -d\n",
    );
    expect(mergeConfig(base, local).worktree.setup).toEqual([
      "docker compose up -d",
    ]);
  });

  it("falls back to base setup when local has none", () => {
    const base = parseConfig("worktree:\n  setup:\n    - poetry install\n");
    expect(mergeConfig(base, emptyConfig()).worktree.setup).toEqual([
      "poetry install",
    ]);
  });

  it("takes the project block from base only (not overridable by local)", () => {
    const base = parseConfig(
      [
        "project:",
        "  port: 8000",
        "  commands:",
        "    start: up",
        "    exit: down",
        "",
      ].join("\n"),
    );
    const local = parseConfig(
      [
        "project:",
        "  port: 9999",
        "  commands:",
        "    start: sneaky-up",
        "    exit: sneaky-down",
        "",
      ].join("\n"),
    );
    const merged = mergeConfig(base, local);
    expect(merged.project).toEqual({
      port: 8000,
      commands: { start: "up", exit: "down" },
    });
  });

  it("lets a stamped worktree.port (local) override the base port", () => {
    const base = parseConfig("project:\n  port: 8000\n");
    const local = parseConfig("worktree:\n  name: feature-x\n  port: 8003\n");
    const merged = mergeConfig(base, local);
    expect(merged.worktree.port).toBe(8003);
    // base worktree.port is 0, so the local assignment wins.
    expect(mergeConfig(base, emptyConfig()).worktree.port).toBe(0);
  });
});
