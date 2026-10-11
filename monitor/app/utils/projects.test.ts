import { describe, expect, it } from "vitest";

import type {
  CommandOutcome,
  HostView,
  InstanceSummary,
  ProjectDetailView,
  WorktreeDetail,
} from "#shared/protocol";

import { emptyState } from "./instances";
import {
  createWorktreeCommand,
  isProjectTab,
  milestoneLoops,
  outcomeOf,
  projectTabValue,
  projectTabs,
  worktreeLabel,
  worktreeLoops,
} from "./projects";

const proj = (name: string, active: boolean) => ({
  name,
  path: `/p/${name}`,
  configured: true,
  backlogRepo: "o/r",
  active,
});

const host = (name: string, online = true): HostView => ({
  host: name,
  pid: 1,
  startedAt: 0,
  online,
  lastSeen: 0,
  projects: [proj("a", true), proj("b", false)],
});

const worktree = (over: Partial<WorktreeDetail> = {}): WorktreeDetail => ({
  name: "dev",
  branch: "dev",
  path: "/p/a-worktrees/dev",
  port: 8001,
  milestone: "plan-x",
  session: "running",
  loopPid: 0,
  ...over,
});

const detail: ProjectDetailView = {
  host: "desk",
  project: "a",
  repo: "o/r",
  forge: "https://g",
  milestones: [],
  worktrees: [worktree()],
  error: "",
  collectedAt: 0,
};

const loop = (over: Partial<InstanceSummary>): InstanceSummary => ({
  id: "l1",
  host: "desk",
  repo: "o/r",
  milestones: [{ id: 1, title: "plan-x" }],
  pid: 1,
  startedAt: 0,
  online: true,
  status: "running",
  paused: false,
  lastSeen: 0,
  ...over,
});

describe("projectTabs", () => {
  it("opens a tab per active project on each host, with its detail when it arrived", () => {
    const tabs = projectTabs({
      ...emptyState,
      hosts: [host("desk"), host("laptop", false)],
      details: [detail],
    });
    expect(
      tabs.map((t) => [t.value, t.online, t.detail?.collectedAt ?? null]),
    ).toEqual([
      ["project:desk/a", true, 0],
      ["project:laptop/a", false, null],
    ]);
  });

  it("drops the tab once the project is closed", () => {
    const closed = { ...host("desk"), projects: [proj("a", false)] };
    expect(projectTabs({ ...emptyState, hosts: [closed] })).toEqual([]);
  });

  it("tells project tab values apart from loop ids", () => {
    expect(isProjectTab(projectTabValue("desk", "a"))).toBe(true);
    expect(isProjectTab("8f1c")).toBe(false);
    expect(isProjectTab(null)).toBe(false);
  });
});

describe("worktrees", () => {
  it("labels the main checkout", () => {
    expect(worktreeLabel(worktree({ name: "" }))).toBe("main");
    expect(worktreeLabel(worktree())).toBe("dev");
  });

  it("links a worktree to the loops on its host, repo and milestone", () => {
    const loops = [
      loop({ id: "hit" }),
      loop({ id: "other-host", host: "laptop" }),
      loop({ id: "other-repo", repo: "o/x" }),
      loop({ id: "other-ms", milestones: [{ id: 2, title: "plan-y" }] }),
    ];
    expect(worktreeLoops(loops, detail, worktree()).map((l) => l.id)).toEqual([
      "hit",
    ]);
    expect(worktreeLoops(loops, detail, worktree({ milestone: "" }))).toEqual(
      [],
    );
  });

  it("pins a worktree to the loop the service started there, by pid", () => {
    const loops = [loop({ id: "a", pid: 10 }), loop({ id: "b", pid: 20 })];
    expect(
      worktreeLoops(loops, detail, worktree({ loopPid: 20 })).map((l) => l.id),
    ).toEqual(["b"]);
  });

  it("finds the online loops working a milestone", () => {
    const loops = [
      loop({ id: "hit" }),
      loop({ id: "offline", online: false }),
      loop({ id: "other-repo", repo: "o/x" }),
    ];
    expect(milestoneLoops(loops, detail, 1).map((l) => l.id)).toEqual(["hit"]);
    expect(milestoneLoops(loops, detail, 2)).toEqual([]);
  });
});

describe("create-worktree", () => {
  it("builds the command, leaving out a blank name and a missing milestone", () => {
    const m = { id: 1, title: "plan-x" };
    expect(createWorktreeCommand("a", "loop", " ", m)).toEqual({
      type: "create-worktree",
      project: "a",
      mode: "loop",
      milestone: m,
    });
    expect(createWorktreeCommand("a", "session", " dev ", null)).toEqual({
      type: "create-worktree",
      project: "a",
      mode: "session",
      name: "dev",
    });
  });

  it("finds a command's outcome by id; null while in flight", () => {
    const o: CommandOutcome = {
      id: "c1",
      ok: false,
      error: "no",
      host: "desk",
      command: { type: "open-project", project: "a" },
      at: 0,
    };
    expect(outcomeOf([o], "c1")).toBe(o);
    expect(outcomeOf([o], "c2")).toBeNull();
  });
});
