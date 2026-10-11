import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { DirEntry } from "./discover.js";
import { discoverProjects, scanProjectsDir } from "./discover.js";

const entry = (
  name: string,
  git: DirEntry["git"],
  jarrinYml: string | null = null,
): DirEntry => ({ name, path: `/p/${name}`, git, jarrinYml });

describe("discoverProjects", () => {
  it("keeps main checkouts only, sorted by name", () => {
    const projects = discoverProjects([
      entry("zeta", "dir"),
      entry("alpha", "dir"),
      entry("linked-wt", "file"), // a linked worktree beside the repos
      entry("plain-folder", "none"),
      entry("prdl-worktrees", "none"),
    ]);
    expect(projects.map((p) => p.name)).toEqual(["alpha", "zeta"]);
  });

  it("excludes <repo>-worktrees and hidden dirs even when they are repos", () => {
    expect(
      discoverProjects([
        entry("prdl-worktrees", "dir"),
        entry(".cache", "dir"),
      ]),
    ).toEqual([]);
  });

  it("reports the claudjar config and the backlog repo", () => {
    const [plain, configured, withPlanRepo] = discoverProjects([
      entry("a", "dir"),
      entry("b", "dir", "rules: [lang-ts]\n"),
      entry(
        "c",
        "dir",
        "backlog:\n  repo: o/base\n  plan:\n    repo: o/plan\n",
      ),
    ]);
    expect(plain).toMatchObject({ configured: false, backlogRepo: "" });
    expect(configured).toMatchObject({ configured: true, backlogRepo: "" });
    expect(withPlanRepo).toMatchObject({
      configured: true,
      backlogRepo: "o/plan",
    });
  });
});

describe("scanProjectsDir", () => {
  it("tells a main checkout from a linked worktree on disk", () => {
    const root = mkdtempSync(join(tmpdir(), "cj-discover-"));
    mkdirSync(join(root, "repo", ".git"), { recursive: true });
    mkdirSync(join(root, "repo", ".claude"));
    writeFileSync(
      join(root, "repo", ".claude", ".jarrin.yml"),
      "backlog:\n  repo: o/r\n",
    );
    mkdirSync(join(root, "sibling-wt"));
    writeFileSync(
      join(root, "sibling-wt", ".git"),
      "gitdir: ../repo/.git/worktrees/x\n",
    );
    mkdirSync(join(root, "repo-worktrees", "feature"), { recursive: true });
    writeFileSync(
      join(root, "repo-worktrees", "feature", ".git"),
      "gitdir: …\n",
    );
    writeFileSync(join(root, "notes.txt"), "");

    const scanned = scanProjectsDir(root);
    expect(
      scanned
        .map((e) => [e.name, e.git])
        .sort(([a = ""], [b = ""]) => a.localeCompare(b)),
    ).toEqual([
      ["repo", "dir"],
      ["repo-worktrees", "none"],
      ["sibling-wt", "file"],
    ]);
    expect(discoverProjects(scanned)).toEqual([
      {
        name: "repo",
        path: join(root, "repo"),
        configured: true,
        backlogRepo: "o/r",
      },
    ]);
  });

  it("throws on an unreadable projects dir", () => {
    expect(() => scanProjectsDir("/nonexistent/claudjar-projects")).toThrow();
  });
});
