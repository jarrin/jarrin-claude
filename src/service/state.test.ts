import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Project } from "./discover.js";
import { runService } from "./run.js";
import {
  emptyState,
  mergeDiscovery,
  parseState,
  readState,
  writeState,
} from "./state.js";

const project = (name: string): Project => ({
  name,
  path: `/p/${name}`,
  configured: true,
  backlogRepo: "",
});

describe("service state", () => {
  it("round-trips, and a missing file is empty", () => {
    const file = join(
      mkdtempSync(join(tmpdir(), "cj-state-")),
      "s",
      "state.json",
    );
    expect(readState(file)).toEqual(emptyState());
    const state = mergeDiscovery(emptyState(), [project("a")], new Date(0));
    writeState(file, state);
    expect(readState(file)).toEqual(state);
  });

  it("carries `active` over by name and follows disk for the list", () => {
    const prev = {
      ...emptyState(),
      projects: [
        { ...project("a"), active: true },
        { ...project("gone"), active: true },
      ],
    };
    const next = mergeDiscovery(
      prev,
      [project("a"), project("b")],
      new Date(0),
    );
    expect(next.projects.map((p) => [p.name, p.active])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("throws on corrupt JSON and drops malformed rows", () => {
    expect(() => parseState("{")).toThrow();
    expect(() => parseState("[]")).toThrow(/not an object/);
    expect(
      parseState(
        JSON.stringify({
          projects: [{ name: "a", path: "/p/a" }, { name: 1 }],
          sessions: [{ name: "s", project: "a", cwd: "/p/a", backend: "x" }],
        }),
      ),
    ).toMatchObject({ projects: [{ name: "a", active: false }], sessions: [] });
  });
});

describe("runService", () => {
  it("logs the discovered projects once and writes the state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cj-run-"));
    const stateFile = join(dir, "state.json");
    const lines: string[] = [];
    await runService({
      conf: { projectsDir: "/p", user: "u", monitor: null },
      stateFile,
      intervalMs: 1000,
      once: true,
      signal: new AbortController().signal,
      log: (l) => lines.push(l),
      scan: () => [
        {
          name: "a",
          path: "/p/a",
          git: "dir",
          jarrinYml: "backlog:\n  repo: o/a\n",
        },
        {
          name: "a-worktrees",
          path: "/p/a-worktrees",
          git: "none",
          jarrinYml: null,
        },
        { name: "wt", path: "/p/wt", git: "file", jarrinYml: null },
      ],
    });
    expect(lines.slice(1)).toEqual([
      "1 project(s):",
      "  a  (claudjar, backlog o/a)",
    ]);
    expect(readState(stateFile).projects.map((p) => p.name)).toEqual(["a"]);
  });

  it("moves a corrupt state file aside instead of crash-looping", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cj-run-"));
    const stateFile = join(dir, "state.json");
    writeFileSync(stateFile, "{not json");
    const lines: string[] = [];
    await runService({
      conf: { projectsDir: "/p", user: "u", monitor: null },
      stateFile,
      intervalMs: 1000,
      once: true,
      signal: new AbortController().signal,
      log: (l) => lines.push(l),
      scan: () => [],
    });
    expect(lines.some((l) => l.includes("moved to"))).toBe(true);
    expect(readFileSync(`${stateFile}.corrupt`, "utf8")).toBe("{not json");
  });
});
