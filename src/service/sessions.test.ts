import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fakeLauncher } from "../session/fake-launcher.js";
import { fakeDetailDeps } from "./fake-detail.js";
import type { FakeLauncher } from "../session/fake-launcher.js";
import {
  launcherName,
  resolveSession,
  sessionLabel,
} from "../session/names.js";
import { attachEntries, renderAttachList, resolveAttach } from "./attach.js";
import { runService } from "./run.js";
import { closeProject, openProject, reconcileSessions } from "./sessions.js";
import type { SessionDeps } from "./sessions.js";
import type { ServiceState, SessionRecord } from "./state.js";
import { emptyState, mergeDiscovery, readState, writeState } from "./state.js";

const now = new Date(1000);

const state = (...names: string[]): ServiceState =>
  mergeDiscovery(
    emptyState(),
    names.map((name) => ({
      name,
      path: `/p/${name}`,
      configured: true,
      backlogRepo: "",
    })),
    new Date(0),
  );

const record = (
  label: string,
  extra: Partial<SessionRecord> = {},
): SessionRecord => {
  const [project = "", worktree = ""] = label.split("/");
  return {
    name: launcherName(label),
    label,
    project,
    worktree,
    cwd: `/p/${label}`,
    backend: "bg",
    startedAt: new Date(0).toISOString(),
    status: "running",
    ...extra,
  };
};

const deps = (launcher: FakeLauncher): SessionDeps => ({
  backend: "bg",
  launcherFor: () => launcher,
  now,
});

describe("session names", () => {
  it("labels the main checkout by project, a worktree as project/worktree", () => {
    expect(sessionLabel("web")).toBe("web");
    expect(sessionLabel("web", "dev-x")).toBe("web/dev-x");
  });

  it("maps a label to a launcher-safe name", () => {
    expect(launcherName("web")).toBe("web");
    expect(launcherName("web/dev-x")).toBe("web--dev-x");
    expect(launcherName("my.site/a:b")).toBe("my_site--a_b");
    expect(launcherName("_x")).toBe("s_x");
  });

  it("resolves by label first, then launcher name", () => {
    const all = [record("web"), record("web/dev")];
    expect(resolveSession(all, "web/dev")?.label).toBe("web/dev");
    expect(resolveSession(all, "web--dev")?.label).toBe("web/dev");
    expect(resolveSession(all, " web ")?.label).toBe("web");
    expect(resolveSession(all, "nope")).toBeNull();
  });
});

describe("openProject / closeProject", () => {
  it("open starts a session, records it, and marks the project active", () => {
    const launcher = fakeLauncher();
    const res = openProject(state("a", "b"), "a", deps(launcher));
    if (!res.ok) throw new Error(res.error);
    expect(launcher.calls).toEqual(["start a /p/a"]);
    expect(res.project.active).toBe(true);
    expect(res.state.sessions).toEqual([
      {
        name: "a",
        label: "a",
        project: "a",
        worktree: "",
        cwd: "/p/a",
        backend: "bg",
        startedAt: now.toISOString(),
        status: "running",
      },
    ]);
  });

  it("open adopts a session that is already running instead of starting another", () => {
    const launcher = fakeLauncher();
    launcher.running.set("a", "/p/a");
    const res = openProject(state("a"), "a", deps(launcher));
    expect(res.ok).toBe(true);
    expect(launcher.calls).toEqual([]);
  });

  it("re-opening an open project whose session died restarts it", () => {
    const launcher = fakeLauncher();
    const opened = openProject(state("a"), "a", deps(launcher));
    if (!opened.ok) throw new Error(opened.error);
    launcher.running.clear();
    const again = openProject(opened.state, "a", deps(launcher));
    if (!again.ok) throw new Error(again.error);
    expect(launcher.calls).toEqual(["start a /p/a", "start a /p/a"]);
    expect(again.state.sessions).toHaveLength(1);
  });

  it("a failed start leaves the state untouched", () => {
    const launcher = fakeLauncher();
    launcher.failStart = true;
    const before = state("a");
    const res = openProject(before, "a", deps(launcher));
    expect(res).toEqual({
      ok: false,
      error: "cannot start a session: Workspace not trusted",
    });
  });

  it("close stops the session, drops the record and clears the flag", () => {
    const launcher = fakeLauncher();
    const opened = openProject(state("a"), "a", deps(launcher));
    if (!opened.ok) throw new Error(opened.error);
    const withWorktree = {
      ...opened.state,
      sessions: [...opened.state.sessions, record("a/dev")],
    };
    const closed = closeProject(withWorktree, "a", deps(launcher));
    if (!closed.ok) throw new Error(closed.error);
    expect(launcher.calls).toEqual(["start a /p/a", "stop a"]);
    expect(closed.project.active).toBe(false);
    // A worktree's session is not the project's to end.
    expect(closed.state.sessions.map((s) => s.label)).toEqual(["a/dev"]);
  });

  it("close of a project whose session is gone just clears the flag", () => {
    const launcher = fakeLauncher();
    const opened = openProject(state("a"), "a", deps(launcher));
    if (!opened.ok) throw new Error(opened.error);
    launcher.running.clear();
    const closed = closeProject(opened.state, "a", deps(launcher));
    if (!closed.ok) throw new Error(closed.error);
    expect(closed.note).toBe("session a was not running");
    expect(launcher.calls).toEqual(["start a /p/a"]);
  });

  it("unknown projects fail both ways", () => {
    const launcher = fakeLauncher();
    expect(openProject(state(), "x", deps(launcher))).toEqual({
      ok: false,
      error: "no project named 'x'",
    });
    expect(closeProject(state(), "x", deps(launcher)).ok).toBe(false);
  });
});

describe("reconcileSessions", () => {
  it("marks gone sessions stopped and re-adopts running ones", () => {
    const launcher = fakeLauncher();
    launcher.running.set("a", "/p/a");
    launcher.running.set("c", "/p/c");
    const prev = {
      ...state("a", "b", "c"),
      sessions: [record("a"), record("b"), record("c", { status: "stopped" })],
    };
    const { state: next, notes } = reconcileSessions(prev, () => launcher);
    expect(next.sessions.map((s) => [s.label, s.status])).toEqual([
      ["a", "running"],
      ["b", "stopped"],
      ["c", "running"],
    ]);
    expect(notes).toEqual([
      "session b: no longer running, marked stopped",
      "session c: re-adopted",
    ]);
    expect(launcher.calls).toEqual([]);
  });

  it("leaves records alone when the backend cannot be listed", () => {
    const launcher = fakeLauncher();
    launcher.failList = true;
    const prev = { ...state("a"), sessions: [record("a")] };
    const { state: next, notes } = reconcileSessions(prev, () => launcher);
    expect(next.sessions).toEqual(prev.sessions);
    expect(notes).toEqual(["cannot list bg sessions: claude agents failed"]);
  });

  it("runs on service start: the active flags survive, sessions are reconciled", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "cj-sess-")), "state.json");
    const prev = state("a", "b");
    writeState(file, {
      ...prev,
      projects: prev.projects.map((p) => ({ ...p, active: true })),
      sessions: [record("a"), record("b")],
    });
    const launcher = fakeLauncher();
    launcher.running.set("a", "/p/a");
    const lines: string[] = [];
    await runService({
      conf: { projectsDir: "/p", user: "u", monitor: null },
      stateFile: file,
      intervalMs: 1000,
      once: true,
      signal: new AbortController().signal,
      log: (l) => lines.push(l),
      scan: () =>
        ["a", "b"].map((name) => ({
          name,
          path: `/p/${name}`,
          git: "dir" as const,
          jarrinYml: "",
        })),
      backend: "bg",
      launcherFor: () => launcher,
      detail: fakeDetailDeps(),
    });
    const after = readState(file);
    expect(after.projects.map((p) => p.active)).toEqual([true, true]);
    expect(after.sessions.map((s) => [s.label, s.status])).toEqual([
      ["a", "running"],
      ["b", "stopped"],
    ]);
    expect(launcher.calls).toEqual([]);
    expect(lines).toContain("session b: no longer running, marked stopped");
  });
});

describe("attach", () => {
  const launcher = fakeLauncher();
  launcher.running.set("web", "/p/web");
  launcher.running.set("web--dev", "/p/web/dev");
  const entries = attachEntries(
    [record("web/dev"), record("web"), record("api")],
    () => launcher,
  );

  it("lists sessions sorted by label with live status", () => {
    expect(entries.map((e) => [e.record.label, e.status])).toEqual([
      ["api", "stopped"],
      ["web", "running"],
      ["web/dev", "running"],
    ]);
    expect(renderAttachList(entries).split("\n")[0]).toBe(
      "api      stopped  bg  /p/api",
    );
    expect(renderAttachList([])).toMatch(/^No sessions/);
  });

  it("resolves a running session by label or launcher name", () => {
    const hit = resolveAttach(entries, "web--dev");
    expect(hit.ok && hit.entry.record.label).toBe("web/dev");
  });

  it("fails on unknown and stopped names, listing the running ones", () => {
    expect(resolveAttach(entries, "nope")).toEqual({
      ok: false,
      error: "no session named 'nope'. Running: web, web/dev",
    });
    const stopped = resolveAttach(entries, "api");
    expect(stopped.ok).toBe(false);
    expect(!stopped.ok && stopped.error).toMatch(
      /^session 'api' is stopped .* Running: web, web\/dev$/,
    );
  });

  it("an unlistable backend reads as unknown and stays attachable", () => {
    const broken = fakeLauncher();
    broken.failList = true;
    const [entry] = attachEntries([record("web")], () => broken);
    expect(entry?.status).toBe("unknown");
    expect(resolveAttach(entry ? [entry] : [], "web").ok).toBe(true);
  });
});
