import { describe, expect, it } from "vitest";

import { emptyWorktreeConfig } from "../config/schema.js";
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
    worktree: {
      ...emptyWorktreeConfig(),
      name: "feature-x",
      setup: ["poetry install"],
    },
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
    expect(out.endsWith("\n")).toBe(true);
  });

  it("shows placeholders when things are empty", () => {
    const out = formatReport({
      ...base,
      rules: [],
      commands: [],
      backup: "",
      worktree: emptyWorktreeConfig(),
      skills: [],
    });
    expect(out).toContain("(none selected)");
    expect(out).toContain("(main worktree)");
    expect(out).toContain("Backup: (none)");
    expect(out).toContain("(none found)");
  });
});
