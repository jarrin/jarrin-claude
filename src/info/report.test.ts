import { describe, expect, it } from "vitest";

import {
  emptyHooksConfig,
  emptyProjectConfig,
  emptyWorktreeConfig,
} from "../config/schema.js";
import type { InfoReport } from "./report.js";
import { backlogMethods, formatReport } from "./report.js";

describe("backlogMethods", () => {
  it("defaults both sections to local when there is no block", () => {
    expect(backlogMethods("rules:\n  - lang-ts\n")).toEqual({
      plan: "local",
      todo: "local",
      repo: "",
    });
  });

  it("reads declared methods and the shared repo", () => {
    const text = [
      "backlog:",
      "  repo: owner/name",
      "  plan:",
      "    method: gitea",
      "  todo:",
      "    method: github",
      "",
    ].join("\n");
    expect(backlogMethods(text)).toEqual({
      plan: "gitea",
      todo: "github",
      repo: "owner/name",
    });
  });

  it("defaults a section without an explicit method to local", () => {
    const text = "backlog:\n  plan:\n    assignee: claude\n";
    expect(backlogMethods(text).plan).toBe("local");
  });

  it("survives malformed YAML", () => {
    expect(backlogMethods("backlog: [oops\n").plan).toBe("local");
  });
});

describe("formatReport", () => {
  const base: InfoReport = {
    repoRoot: "/home/j/app",
    hasBase: true,
    hasLocal: false,
    rules: [
      { label: "lang-ts", path: "/rules/lang-ts.md", exists: true },
      { label: "fw-nuxtjs", path: "/rules/fw-nuxtjs.md", exists: false },
    ],
    commands: [{ cmd: "pnpm check", desc: "gates" }],
    backup: "git bundle create ../b --all",
    hasJarrinMd: true,
    project: {
      slug: "app",
      port: 8000,
      commands: {
        start: "docker compose up -d",
        exit: "docker compose down",
        build: "",
      },
      dist: { version: "1.4.0", sync: ["package.json"] },
    },
    hooks: {
      worktree: {
        create: ["pnpm install"],
        remove: ["docker system prune -f"],
      },
    },
    worktree: {
      ...emptyWorktreeConfig(),
      name: "feature-x",
      port: 8001,
      setup: ["poetry install"],
    },
    caddy: { enabled: true },
    backlog: { plan: "gitea", todo: "local", repo: "owner/name" },
    skills: ["todo", "staged-planning"],
  };

  it("marks rule presence and lists all sections", () => {
    const out = formatReport(base);
    expect(out).toContain("/home/j/app");
    expect(out).toContain("✓ lang-ts");
    expect(out).toContain("✗ fw-nuxtjs");
    expect(out).toContain("pnpm check — gates");
    expect(out).toContain("plan: gitea");
    expect(out).toContain("name:  feature-x");
    expect(out).toContain("poetry install");
    expect(out).toContain("todo, staged-planning");
    // Project stack section + the worktree's assigned port.
    expect(out).toContain("Project stack:");
    expect(out).toContain("port:  8000");
    expect(out).toContain("start: docker compose up -d");
    expect(out).toContain("exit:  docker compose down");
    expect(out).toContain("port:  8001");
    // Release surface and lifecycle hooks.
    expect(out).toContain("Release (project.dist):");
    expect(out).toContain("version: 1.4.0");
    expect(out).toContain("sync:    package.json");
    expect(out).toContain("worktree create: pnpm install");
    expect(out).toContain("worktree remove: docker system prune -f");
    expect(out.endsWith("\n")).toBe(true);
  });

  it("shows placeholders when things are empty", () => {
    const out = formatReport({
      ...base,
      rules: [],
      commands: [],
      backup: "",
      project: emptyProjectConfig(),
      hooks: emptyHooksConfig(),
      worktree: emptyWorktreeConfig(),
      skills: [],
    });
    expect(out).toContain("(unset — first release starts at 0.0.1)");
    expect(out).toContain("worktree create: (none)");
    expect(out).toContain("(none selected)");
    expect(out).toContain("(main worktree)");
    expect(out).toContain("Backup: (none)");
    expect(out).toContain("(none found)");
    expect(out).toContain("(unset — feature off)");
    expect(out).toContain("(none — main worktree)");
  });
});
