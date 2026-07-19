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

  it("parses the worktree block (dir, copy, setup, name, port)", () => {
    const cfg = parseConfig(
      [
        "worktree:",
        "  dir: ../wts",
        "  name: feature-x",
        "  port: 8001",
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
      port: 8001,
      slug: "",
      copy: [".env", ".claude/settings.local.json"],
      setup: ["poetry install", "docker compose up -d"],
    });
  });

  it("defaults to an empty worktree block when absent", () => {
    const cfg = parseConfig("rules:\n  - lang-ts\n");
    expect(cfg.worktree).toEqual({
      dir: "",
      copy: [],
      setup: [],
      name: "",
      port: 0,
      slug: "",
    });
  });

  it("parses the project block (port + start/exit commands)", () => {
    const cfg = parseConfig(
      [
        "project:",
        "  port: 8000",
        "  commands:",
        "    start: docker compose up -d",
        "    exit: docker compose down",
        "",
      ].join("\n"),
    );
    expect(cfg.project).toEqual({
      slug: "",
      port: 8000,
      commands: {
        start: "docker compose up -d",
        exit: "docker compose down",
        build: "",
      },
      dist: { version: "", sync: [] },
    });
  });

  it("parses the project.dist release surface", () => {
    const cfg = parseConfig(
      [
        "project:",
        "  commands:",
        "    build: pnpm build",
        "  dist:",
        "    version: 1.2.3",
        "    sync:",
        "      - package.json",
        "      - src/worker/pyproject.toml",
        "",
      ].join("\n"),
    );
    expect(cfg.project.commands.build).toBe("pnpm build");
    expect(cfg.project.dist).toEqual({
      version: "1.2.3",
      sync: ["package.json", "src/worker/pyproject.toml"],
    });
  });

  it("normalises a version YAML parsed as a number to a string", () => {
    // `version: 1.2` is a valid YAML float; three-segment versions are not.
    expect(
      parseConfig("project:\n  dist:\n    version: 1.2\n").project.dist.version,
    ).toBe("1.2");
  });

  it("defaults the project block, and coerces a non-integer port to 0", () => {
    expect(parseConfig("rules:\n  - lang-ts\n").project).toEqual({
      slug: "",
      port: 0,
      commands: { start: "", exit: "", build: "" },
      dist: { version: "", sync: [] },
    });
    expect(parseConfig("project:\n  port: not-a-number\n").project.port).toBe(
      0,
    );
    expect(parseConfig("project:\n  port: 0\n").project.port).toBe(0);
  });
  it("parses project.slug, accepting a numeric YAML scalar", () => {
    expect(parseConfig("project:\n  slug: prdl\n").project.slug).toBe("prdl");
    // `slug: 2048` is a plausible project name YAML hands over as a number.
    expect(parseConfig("project:\n  slug: 2048\n").project.slug).toBe("2048");
    expect(parseConfig("project:\n  slug:\n    a: b\n").project.slug).toBe("");
  });

  it("parses the caddy block as a strict opt-in", () => {
    expect(parseConfig("caddy:\n  enabled: true\n").caddy.enabled).toBe(true);
    expect(parseConfig("caddy:\n  enabled: false\n").caddy.enabled).toBe(false);
    expect(parseConfig("rules:\n  - lang-ts\n").caddy.enabled).toBe(false);
    // Only a real boolean opts in — a stray string must not enable a proxy.
    expect(parseConfig("caddy:\n  enabled: yes-please\n").caddy.enabled).toBe(
      false,
    );
    expect(parseConfig("caddy: true\n").caddy.enabled).toBe(false);
  });

  it("parses the worktree caddy segment override", () => {
    expect(parseConfig("worktree:\n  slug: fl\n").worktree.slug).toBe("fl");
  });
});
