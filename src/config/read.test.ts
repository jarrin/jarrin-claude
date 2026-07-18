import { describe, expect, it } from "vitest";

import { parseConfig } from "./read.js";

describe("parseConfig", () => {
  it("reads a block list of rules", () => {
    const cfg = parseConfig("rules:\n  - lang-ts\n  - fw-nuxtjs\n");
    expect(cfg.rules).toEqual(["lang-ts", "fw-nuxtjs"]);
  });

  it("reads an inline flow list", () => {
    const cfg = parseConfig("rules: [lang-php, fw-laravel]\n");
    expect(cfg.rules).toEqual(["lang-php", "fw-laravel"]);
  });

  it("reads imports and commands mapping lists", () => {
    const cfg = parseConfig(
      [
        "imports:",
        "  - owner: server",
        "    rule: prdl-data-types",
        "commands:",
        "  - cmd: prdl deploy",
        "    desc: ship to production",
        "",
      ].join("\n"),
    );
    expect(cfg.imports).toEqual([{ owner: "server", rule: "prdl-data-types" }]);
    expect(cfg.commands).toEqual([
      { cmd: "prdl deploy", desc: "ship to production" },
    ]);
  });

  it("reads a scalar backup command", () => {
    const cfg = parseConfig("backup: git bundle create ../b.bundle --all\n");
    expect(cfg.backup).toBe("git bundle create ../b.bundle --all");
  });

  it("treats a bare top-level list as rules (back-compat)", () => {
    const cfg = parseConfig("- lang-ts\n- fw-wxt\n");
    expect(cfg.rules).toEqual(["lang-ts", "fw-wxt"]);
  });

  it("ignores a nested backlog block without corrupting other tiers", () => {
    const cfg = parseConfig(
      [
        "rules:",
        "  - lang-ts",
        "backlog:",
        "  repo: owner/name",
        "  plan:",
        "    method: gitea",
        "    assignee: claude",
        "commands:",
        "  - cmd: pnpm check",
        "    desc: gates",
        "",
      ].join("\n"),
    );
    expect(cfg.rules).toEqual(["lang-ts"]);
    expect(cfg.commands).toEqual([{ cmd: "pnpm check", desc: "gates" }]);
    expect(cfg).not.toHaveProperty("backlog");
  });

  it("drops incomplete imports and blank entries", () => {
    const cfg = parseConfig("imports:\n  - owner: server\nrules:\n  - ''\n");
    expect(cfg.imports).toEqual([]);
    expect(cfg.rules).toEqual([]);
  });

  it("returns an empty config for malformed YAML", () => {
    const cfg = parseConfig("rules: [unterminated\n");
    expect(cfg.rules).toEqual([]);
  });

  it("parses the worktree block (dir, copy, setup, name)", () => {
    const cfg = parseConfig(
      [
        "worktree:",
        "  dir: ../wts",
        "  name: feature-x",
        "  copy:",
        "    - .env",
        "    - .claude/settings.local.json",
        "  setup:",
        "    - poetry install",
        "    - docker compose up -d",
        "",
      ].join("\n"),
    );
    expect(cfg.worktree).toEqual({
      dir: "../wts",
      name: "feature-x",
      copy: [".env", ".claude/settings.local.json"],
      setup: ["poetry install", "docker compose up -d"],
    });
  });

  it("defaults to an empty worktree block when absent", () => {
    const cfg = parseConfig("rules:\n  - lang-ts\n");
    expect(cfg.worktree).toEqual({ dir: "", copy: [], setup: [], name: "" });
  });
});
