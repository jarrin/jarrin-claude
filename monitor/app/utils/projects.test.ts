import { describe, expect, it } from "vitest";

import type {
  CommandOutcome,
  HostView,
  InstanceSummary,
  ProjectDetailView,
  Question,
  WorktreeDetail,
} from "#shared/protocol";

import { emptyState } from "./instances";
import {
  createWorktreeCommand,
  isProjectTab,
  loopEnded,
  loopParent,
  loopRunning,
  loopsUnder,
  milestoneLoops,
  outcomeOf,
  projectOpenQuestions,
  projectTabValue,
  projectTabs,
  worktreeActionState,
  worktreeCommand,
  worktreeLabel,
  worktreeLoops,
  worktreeOfInstance,
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

describe("projectOpenQuestions", () => {
  const question = (id: string, over: Partial<Question> = {}): Question => ({
    id,
    repo: "o/r",
    milestone: { id: 1, title: "plan-x" },
    issue: 3,
    title: "t",
    text: "?",
    askedAt: 0,
    answer: null,
    answeredAt: null,
    ...over,
  });

  it("counts the unanswered questions of the project's loops, once each", () => {
    const state = {
      ...emptyState,
      instances: [
        { ...loop({ id: "l1" }), lines: [] },
        { ...loop({ id: "l2" }), lines: [] },
        { ...loop({ id: "other", repo: "o/elsewhere" }), lines: [] },
      ],
      questions: [
        question("q1"),
        question("q2", { answer: "yes", answeredAt: 1 }),
        question("q3", { repo: "o/elsewhere" }),
      ],
    };
    expect(projectOpenQuestions(state, detail).map((q) => q.id)).toEqual([
      "q1",
    ]);
  });

  it("is empty before the detail arrives", () => {
    expect(projectOpenQuestions(emptyState, null)).toEqual([]);
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

describe("worktree actions", () => {
  it("tells an ended loop from a running one", () => {
    expect(loopEnded("aborted")).toBe(true);
    expect(loopEnded("interrupted")).toBe(true);
    expect(loopEnded("finished: no open issues left")).toBe(true);
    expect(loopEnded("working #3 x")).toBe(false);
    expect(loopRunning(loop({}))).toBe(true);
    expect(loopRunning(loop({ status: "aborted" }))).toBe(false);
    expect(loopRunning(loop({ online: false }))).toBe(false);
  });

  it("only lets an ended loop's worktree be merged or restarted", () => {
    const idle = worktree({ session: "none" });
    expect(
      worktreeActionState(idle, [loop({ status: "running" })], true),
    ).toEqual({
      running: true,
      canAbort: true,
      canRestart: false,
      canMerge: false,
      canRemove: true,
      hint: "a loop runs here — abort it first",
    });
    expect(
      worktreeActionState(idle, [loop({ status: "finished: done" })], true),
    ).toMatchObject({
      running: false,
      canAbort: false,
      canRestart: true,
      canMerge: true,
      hint: "",
    });
    // The service's own loop, by pid, counts even before it connects.
    expect(
      worktreeActionState({ ...idle, loopPid: 9 }, [], true),
    ).toMatchObject({ running: true, canMerge: false });
    // …but once it has connected and ended, its status wins over the stale pid.
    expect(
      worktreeActionState(
        { ...idle, loopPid: 9 },
        [loop({ status: "aborted" })],
        true,
      ),
    ).toMatchObject({ running: false, canMerge: true });
  });

  it("refuses merge and restart while a session runs, and everything offline", () => {
    expect(worktreeActionState(worktree(), [], true)).toMatchObject({
      canMerge: false,
      canRestart: false,
      canRemove: true,
      hint: "a session runs here — end it first",
    });
    expect(
      worktreeActionState(worktree({ session: "none" }), [], false),
    ).toMatchObject({ canMerge: false, canRemove: false, canAbort: false });
    expect(
      worktreeActionState(
        worktree({ session: "none", milestone: "" }),
        [],
        true,
      ),
    ).toMatchObject({ canRestart: false, canMerge: true });
  });

  it("offers nothing on the main checkout", () => {
    expect(worktreeActionState(worktree({ name: "" }), [], true)).toMatchObject(
      { canMerge: false, canRemove: false, canAbort: false },
    );
  });

  it("builds the commands", () => {
    expect(worktreeCommand("stop-loop", "a", "dev")).toEqual({
      type: "stop-loop",
      project: "a",
      worktree: "dev",
    });
    expect(worktreeCommand("merge-worktree", "a", "dev", true)).toEqual({
      type: "merge-worktree",
      project: "a",
      worktree: "dev",
      remove: true,
    });
  });

  it("finds a loop's worktree: by pid first, then by milestone", () => {
    const pinned = worktree({ name: "pinned", milestone: "", loopPid: 5 });
    const d = {
      ...detail,
      worktrees: [worktree({ name: "" }), worktree(), pinned],
    };
    expect(worktreeOfInstance([d], loop({ pid: 5 }))?.worktree).toBe(pinned);
    expect(worktreeOfInstance([d], loop({}))?.worktree.name).toBe("dev");
    expect(worktreeOfInstance([d], loop({ host: "other" }))).toBeNull();
    expect(
      worktreeOfInstance([d], loop({ milestones: [{ id: 2, title: "y" }] })),
    ).toBeNull();
  });
});

describe("loopParent / loopsUnder", () => {
  const OVERVIEW = "projects";

  it("puts a loop under the open project whose worktree it works", () => {
    expect(loopParent([detail], loop({}), OVERVIEW)).toBe(
      projectTabValue("desk", "a"),
    );
  });

  it("puts a loop no open project claims under the overview", () => {
    expect(loopParent([], loop({}), OVERVIEW)).toBe(OVERVIEW);
    expect(loopParent([detail], loop({ repo: "o/other" }), OVERVIEW)).toBe(
      OVERVIEW,
    );
  });

  it("splits the loops between their parents", () => {
    const mine = loop({ id: "mine" });
    const stray = loop({ id: "stray", repo: "o/other" });
    const all = [mine, stray];
    expect(
      loopsUnder(projectTabValue("desk", "a"), all, [detail], OVERVIEW),
    ).toEqual([mine]);
    expect(loopsUnder(OVERVIEW, all, [detail], OVERVIEW)).toEqual([stray]);
  });
});
