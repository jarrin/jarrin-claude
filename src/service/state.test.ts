import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type {
  ProjectDetail,
  ProjectInfo,
} from "../../monitor/shared/protocol.js";
import { fakeLauncher } from "../session/fake-launcher.js";
import { fakeDetailDeps } from "./fake-detail.js";
import type { Project } from "./discover.js";
import type { HostLink } from "./link.js";
import { runService } from "./run.js";
import type { LinkHandlers } from "./run.js";
import {
  emptyState,
  mergeDiscovery,
  parseState,
  readState,
  setActive,
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
      backend: "bg",
      launcherFor: () => fakeLauncher(),
      detail: fakeDetailDeps(),
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
      backend: "bg",
      launcherFor: () => fakeLauncher(),
      detail: fakeDetailDeps(),
      log: (l) => lines.push(l),
      scan: () => [],
    });
    expect(lines.some((l) => l.includes("moved to"))).toBe(true);
    expect(readFileSync(`${stateFile}.corrupt`, "utf8")).toBe("{not json");
  });

  it("publishes every scan and runs open / close commands against the state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cj-run-"));
    const stateFile = join(dir, "state.json");
    const published: (readonly ProjectInfo[])[] = [];
    const changed: ProjectInfo[] = [];
    const details: ProjectDetail[] = [];
    let closed = false;
    let handlers: LinkHandlers | null = null;
    const link: HostLink = {
      publish: (p) => published.push(p),
      projectState: (p) => changed.push(p),
      detail: (d) => details.push(d),
      close: () => {
        closed = true;
      },
    };
    const controller = new AbortController();
    const launcher = fakeLauncher();
    const run = runService({
      backend: "bg",
      launcherFor: () => launcher,
      detail: fakeDetailDeps({
        worktrees: { "/p/a": "worktree /p/a\nbranch refs/heads/main\n" },
      }),
      conf: { projectsDir: "/p", user: "u", monitor: null },
      stateFile,
      intervalMs: 60_000,
      once: false,
      signal: controller.signal,
      log: () => {},
      scan: () => [{ name: "a", path: "/p/a", git: "dir", jarrinYml: null }],
      connect: (h) => {
        handlers = h;
        return link;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(published).toEqual([
      [{ ...project("a"), configured: false, active: false }],
    ]);
    const h = handlers as LinkHandlers | null;
    if (!h) throw new Error("not connected");

    expect(await h.onCommand({ type: "open-project", project: "a" })).toEqual({
      ok: true,
    });
    expect(changed.at(-1)).toMatchObject({ name: "a", active: true });
    expect(readState(stateFile).projects[0]?.active).toBe(true);
    expect(h.projects()[0]?.active).toBe(true);
    expect(launcher.calls).toEqual(["start a /p/a"]);
    expect(readState(stateFile).sessions).toMatchObject([
      { label: "a", name: "a", status: "running" },
    ]);
    // The detail follows the open, once collected.
    await new Promise((r) => setTimeout(r, 0));
    expect(details).toMatchObject([
      {
        project: "a",
        error: "not a claudjar project",
        worktrees: [{ name: "", branch: "main", session: "running" }],
      },
    ]);
    expect(
      await h.onCommand({ type: "refresh-project", project: "a" }),
    ).toEqual({ ok: true });
    expect(details).toHaveLength(2);
    expect(
      await h.onCommand({ type: "refresh-project", project: "nope" }),
    ).toEqual({ ok: false, error: "no project named 'nope'" });

    expect(await h.onCommand({ type: "close-project", project: "a" })).toEqual({
      ok: true,
    });
    expect(readState(stateFile).projects[0]?.active).toBe(false);
    expect(readState(stateFile).sessions).toEqual([]);
    expect(launcher.calls).toEqual(["start a /p/a", "stop a"]);

    expect(
      await h.onCommand({ type: "open-project", project: "nope" }),
    ).toEqual({
      ok: false,
      error: "no project named 'nope'",
    });

    controller.abort();
    await run;
    expect(closed).toBe(true);
  });
});

describe("setActive", () => {
  it("flips one project's flag and leaves the rest alone", () => {
    const state = mergeDiscovery(
      emptyState(),
      [project("a"), project("b")],
      new Date(0),
    );
    const res = setActive(state, "b", true, new Date(1000));
    expect(res?.project).toEqual({ ...project("b"), active: true });
    expect(res?.state.projects.map((p) => p.active)).toEqual([false, true]);
    expect(res?.state.updatedAt).toBe(new Date(1000).toISOString());
  });

  it("returns null for a project that was not discovered", () => {
    expect(setActive(emptyState(), "x", true, new Date(0))).toBeNull();
  });
});
