import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { WorktreeDetail } from "../../monitor/shared/protocol.js";
import { commandTimeoutMs } from "../../monitor/shared/protocol.js";
import { fakeLauncher } from "../session/fake-launcher.js";
import type { FakeLauncher } from "../session/fake-launcher.js";
import type { FakeWorktrees } from "./fake-worktrees.js";
import { fakeWorktreeDeps } from "./fake-worktrees.js";
import { fakeDetailDeps } from "./fake-detail.js";
import type { HostLink } from "./link.js";
import type { LinkHandlers } from "./run.js";
import { runService } from "./run.js";
import type { ManageCommand, ManageDeps } from "./manage.js";
import { manage, parentCheckout } from "./manage.js";
import { isAlive } from "../commands/loop.js";
import { stopLoopProcess } from "./spawn-loop.js";
import type { LoopRecord, ServiceState, SessionRecord } from "./state.js";
import { emptyState, readState } from "./state.js";

const now = new Date(5000);
const plan = { id: 7, title: "plan-x" };

const wt = (over: Partial<WorktreeDetail>): WorktreeDetail => ({
  name: "",
  branch: "",
  path: "",
  port: 0,
  milestone: "",
  session: "none",
  loopPid: 0,
  ...over,
});

const MAIN = wt({ branch: "main", path: "/p/web" });
const X = wt({
  name: "plan-x",
  branch: "plan-x",
  path: "/p/web-worktrees/plan-x",
  milestone: plan.title,
});
const DEV = wt({ name: "dev", branch: "dev", path: "/p/web-worktrees/dev" });
const DEV_Y = wt({
  name: "dev-y",
  branch: "dev-y",
  path: "/p/web-worktrees/dev-y",
});

const loopRecord = (over: Partial<LoopRecord> = {}): LoopRecord => ({
  project: "web",
  worktree: "plan-x",
  cwd: X.path,
  milestone: plan,
  pid: 99,
  log: "",
  startedAt: "",
  ...over,
});

const sessionRecord: SessionRecord = {
  name: "web--plan-x",
  label: "web/plan-x",
  project: "web",
  worktree: "plan-x",
  cwd: X.path,
  backend: "bg",
  startedAt: "",
  status: "running",
};

const state = (
  over: {
    active?: boolean;
    loops?: LoopRecord[];
    sessions?: SessionRecord[];
  } = {},
): ServiceState => ({
  ...emptyState(),
  projects: [
    {
      name: "web",
      path: "/p/web",
      configured: true,
      backlogRepo: "o/web",
      active: over.active ?? true,
    },
  ],
  loops: over.loops ?? [],
  sessions: over.sessions ?? [],
});

interface Setup {
  readonly fake?: Omit<FakeWorktrees, "onStop">;
  readonly alive?: number[];
  readonly checkouts?: WorktreeDetail[];
  readonly milestones?: { id: number; title: string }[];
  readonly launcher?: FakeLauncher;
}

function setup(s: Setup = {}) {
  const alive = new Set(s.alive ?? []);
  const wts = fakeWorktreeDeps({
    ...s.fake,
    onStop: (pid) => alive.delete(pid),
  });
  const launcher = s.launcher ?? fakeLauncher();
  const deps: ManageDeps = {
    ...wts,
    isAlive: (pid) => alive.has(pid),
    checkouts: () => s.checkouts ?? [MAIN, X],
    milestones: () => Promise.resolve(s.milestones ?? [plan]),
    session: { backend: "bg", launcherFor: () => launcher, now },
  };
  return { deps, wts, launcher, alive };
}

const run = (st: ServiceState, cmd: ManageCommand, deps: ManageDeps) =>
  manage(() => st, cmd, deps);

const merge = (remove = false): ManageCommand => ({
  type: "merge-worktree",
  project: "web",
  worktree: "plan-x",
  remove,
});
const remove: ManageCommand = {
  type: "remove-worktree",
  project: "web",
  worktree: "plan-x",
};
const stop: ManageCommand = {
  type: "stop-loop",
  project: "web",
  worktree: "plan-x",
};
const resume: ManageCommand = {
  type: "resume-loop",
  project: "web",
  worktree: "plan-x",
};

describe("parentCheckout", () => {
  it("is the longest stamped-name prefix, else the main checkout", () => {
    const all = [MAIN, DEV, DEV_Y, X];
    expect(parentCheckout(all, DEV_Y)).toBe(DEV);
    expect(parentCheckout(all, X)).toBe(MAIN);
    expect(parentCheckout(all, DEV)).toBe(MAIN);
    const devYZ = wt({ name: "dev-y-z" });
    expect(parentCheckout(all, devYZ)).toBe(DEV_Y);
  });
});

describe("common guards", () => {
  it.each<[string, ServiceState, ManageCommand, string]>([
    [
      "an unknown project",
      state(),
      { ...merge(), project: "nope" },
      "no project",
    ],
    ["a closed project", state({ active: false }), merge(), "open project"],
    [
      "an unknown worktree",
      state(),
      { ...remove, worktree: "zz" },
      "no worktree named 'zz'",
    ],
    [
      "the main checkout",
      state(),
      { ...remove, worktree: "" },
      "no worktree named",
    ],
  ])("refuses %s", async (_what, st, cmd, error) => {
    const { deps, wts } = setup();
    const res = await run(st, cmd, deps);
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).toContain(error);
    expect(wts.merged).toEqual([]);
    expect(wts.removed).toEqual([]);
  });
});

describe("merge-worktree", () => {
  it("merges into the parent checkout, aborting on conflict", async () => {
    const { deps, wts } = setup();
    const res = await run(state(), merge(), deps);
    expect(res).toMatchObject({ ok: true, note: "merged plan-x into main" });
    expect(wts.merged).toEqual([
      {
        repoRoot: "/p/web",
        opts: { name: "plan-x", remove: false, abortOnConflict: true },
      },
    ]);
  });

  it("merges a nested worktree into the worktree it was cut from", async () => {
    const { deps, wts } = setup({ checkouts: [MAIN, DEV, DEV_Y] });
    await run(state(), { ...merge(), worktree: "dev-y" }, deps);
    expect(wts.merged[0]?.repoRoot).toBe(DEV.path);
  });

  it.each<[string, Setup, ServiceState, string]>([
    [
      "while a recorded loop runs",
      { alive: [99] },
      state({ loops: [loopRecord()] }),
      "a loop runs in worktree plan-x (pid 99) — abort it first",
    ],
    [
      "while a loop holds the worktree's lock",
      { fake: { lockHolders: { [X.path]: 314 } } },
      state(),
      "(pid 314)",
    ],
    [
      "while the pinned loop runs",
      { alive: [55], checkouts: [MAIN, { ...X, loopPid: 55 }] },
      state(),
      "(pid 55)",
    ],
    [
      "while a session runs in it",
      {
        launcher: (() => {
          const l = fakeLauncher();
          l.running.set("web--plan-x", X.path);
          return l;
        })(),
      },
      state({ sessions: [sessionRecord] }),
      "session web/plan-x runs in worktree plan-x — end it first",
    ],
    [
      "when the worktree is dirty",
      { fake: { dirty: { [X.path]: [" M a.ts", "?? b.ts"] } } },
      state(),
      "worktree plan-x has 2 uncommitted change(s) ( M a.ts, ?? b.ts)",
    ],
    [
      "when the target is dirty",
      { fake: { dirty: { [MAIN.path]: [" M x"] } } },
      state(),
      "the main checkout has 1 uncommitted change(s)",
    ],
  ])("refuses %s", async (_what, s, st, error) => {
    const { deps, wts } = setup(s);
    const res = await run(st, merge(true), deps);
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).toContain(error);
    expect(wts.merged).toEqual([]);
    expect(wts.stopped).toEqual([]);
  });

  it("does not count a dead recorded loop or a stopped session", async () => {
    const { deps, wts } = setup();
    const res = await run(
      state({ loops: [loopRecord()], sessions: [sessionRecord] }),
      merge(),
      deps,
    );
    expect(res.ok).toBe(true);
    expect(wts.merged).toHaveLength(1);
  });

  it("reports the conflicted files", async () => {
    const { deps } = setup({
      fake: {
        mergeResult: {
          ok: false,
          error:
            "conflict in 2 file(s); the merge was aborted, nothing changed.",
          conflicts: ["a.ts", "b.ts"],
        },
      },
    });
    const res = await run(state(), merge(), deps);
    expect(res).toEqual({
      ok: false,
      error:
        "conflict in 2 file(s); the merge was aborted, nothing changed. Conflicted: a.ts, b.ts",
    });
  });

  it("with remove, forgets the worktree's records", async () => {
    const { deps } = setup();
    const st = state({
      loops: [loopRecord(), loopRecord({ worktree: "other" })],
      sessions: [{ ...sessionRecord, status: "stopped" }],
    });
    const res = await run(st, merge(true), deps);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.note).toBe("merged plan-x into main and removed it");
    expect(res.state.loops.map((l) => l.worktree)).toEqual(["other"]);
    expect(res.state.sessions).toEqual([]);
  });
});

describe("remove-worktree", () => {
  it("stops the session and loop, then removes and forgets it", async () => {
    const launcher = fakeLauncher();
    launcher.running.set("web--plan-x", X.path);
    const { deps, wts } = setup({ alive: [99], launcher });
    const res = await run(
      state({ loops: [loopRecord()], sessions: [sessionRecord] }),
      remove,
      deps,
    );
    expect(res).toMatchObject({
      ok: true,
      note: "removed worktree plan-x (stopped session web/plan-x, loop pid 99)",
    });
    expect(launcher.calls).toEqual(["stop web--plan-x"]);
    expect(wts.stopped).toEqual([99]);
    expect(wts.removed).toEqual([
      { repoRoot: "/p/web", opts: { name: "plan-x" } },
    ]);
    if (res.ok) {
      expect(res.state.loops).toEqual([]);
      expect(res.state.sessions).toEqual([]);
    }
  });

  it("refuses a dirty tree before stopping anything", async () => {
    const { deps, wts } = setup({ fake: { dirty: { [X.path]: ["?? x"] } } });
    const res = await run(state(), remove, deps);
    expect(res.ok).toBe(false);
    expect(wts.removed).toEqual([]);
  });

  it("refuses when the loop does not stop", async () => {
    const { deps, wts } = setup({ alive: [99], fake: { stopsLoop: false } });
    const res = await run(state({ loops: [loopRecord()] }), remove, deps);
    expect(res).toEqual({
      ok: false,
      error: "loop pid 99 was asked to stop but is still running",
    });
    expect(wts.removed).toEqual([]);
  });

  it("reports a kept branch and a failed remove hook", async () => {
    const { deps } = setup({
      fake: {
        removeResult: {
          ok: true,
          path: X.path,
          branchKept: true,
          hookError: "prune failed",
        },
      },
    });
    const res = await run(state(), remove, deps);
    expect(res).toMatchObject({
      ok: true,
      note: "removed worktree plan-x; branch kept (unmerged); a remove hook failed: prune failed",
    });
  });
});

describe("stop-loop", () => {
  it("SIGTERMs the worktree's loop", async () => {
    const { deps, wts } = setup({ alive: [99] });
    const res = await run(state({ loops: [loopRecord()] }), stop, deps);
    expect(res).toMatchObject({ ok: true });
    expect(wts.stopped).toEqual([99]);
  });

  it("refuses when no loop runs there", async () => {
    const { deps } = setup();
    const res = await run(state({ loops: [loopRecord()] }), stop, deps);
    expect(res).toEqual({
      ok: false,
      error: "no loop is running in worktree plan-x",
    });
  });
});

describe("resume-loop", () => {
  it("restarts the loop on the recorded milestone and records it", async () => {
    const { deps, wts } = setup({
      fake: { pid: 777 },
      milestones: [],
    });
    const res = await run(state({ loops: [loopRecord()] }), resume, deps);
    expect(wts.loops).toEqual([
      { cwd: X.path, repo: "o/web", milestone: plan, label: "web/plan-x" },
    ]);
    expect(res).toMatchObject({ ok: true });
    if (res.ok)
      expect(res.state.loops).toEqual([
        loopRecord({
          pid: 777,
          log: "/logs/web/plan-x.log",
          startedAt: now.toISOString(),
        }),
      ]);
  });

  it("looks the stamped milestone up when nothing is recorded", async () => {
    const { deps, wts } = setup({
      milestones: [{ id: 3, title: "other" }, plan],
    });
    const res = await run(state(), resume, deps);
    expect(res.ok).toBe(true);
    expect(wts.loops[0]?.milestone).toEqual(plan);
  });

  it.each<[string, Setup, ServiceState, string]>([
    [
      "a loop that still runs",
      { alive: [99] },
      state({ loops: [loopRecord()] }),
      "a loop already runs",
    ],
    [
      "a milestone another loop holds",
      { fake: { holders: { "o/web#7": 31 } } },
      state(),
      'milestone "plan-x" is already worked by a loop (pid 31)',
    ],
    [
      "a closed milestone",
      { milestones: [] },
      state(),
      'milestone "plan-x" is not open any more',
    ],
    [
      "a worktree with no milestone",
      { checkouts: [MAIN, { ...X, milestone: "" }] },
      state(),
      "is not linked to a milestone",
    ],
    [
      "a worktree with a session",
      {
        launcher: (() => {
          const l = fakeLauncher();
          l.running.set("web--plan-x", X.path);
          return l;
        })(),
      },
      state({ sessions: [sessionRecord] }),
      "must not share a working tree",
    ],
  ])("refuses %s", async (_what, s, st, error) => {
    const { deps, wts } = setup(s);
    const res = await run(st, resume, deps);
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).toContain(error);
    expect(wts.loops).toEqual([]);
  });

  it("reports a loop that does not start", async () => {
    const { deps } = setup({ fake: { loopError: "lock taken" } });
    const res = await run(state(), resume, deps);
    expect(res).toEqual({
      ok: false,
      error: "the loop did not start: lock taken",
    });
  });
});

describe("commandTimeoutMs", () => {
  it("gives merge and remove the long timeout", () => {
    expect(commandTimeoutMs(merge())).toBe(15 * 60 * 1000);
    expect(commandTimeoutMs(remove)).toBe(15 * 60 * 1000);
    expect(commandTimeoutMs(stop)).toBe(60 * 1000);
  });
});

describe("stopLoopProcess", () => {
  it("SIGTERMs a process and waits for it to exit", async () => {
    const child = spawn("sleep", ["30"], { stdio: "ignore" });
    const pid = child.pid ?? 0;
    const exited = new Promise((r) => child.once("exit", r));
    // A zombie still answers kill(0): count it dead once it has exited.
    let gone = false;
    void exited.then(() => (gone = true));
    expect(
      await stopLoopProcess(pid, (p) => !gone && isAlive(p), { pollMs: 10 }),
    ).toBe(true);
  });

  it("is false when the process outlives the timeout", async () => {
    const child = spawn(
      "node",
      ["-e", "process.on('SIGTERM',()=>{});setTimeout(()=>{},30000)"],
      { stdio: "ignore" },
    );
    const pid = child.pid ?? 0;
    await new Promise((r) => setTimeout(r, 200));
    expect(
      await stopLoopProcess(pid, isAlive, { timeoutMs: 100, pollMs: 10 }),
    ).toBe(false);
    child.kill("SIGKILL");
  });
});

describe("runService: worktree commands", () => {
  it("dispatches resume-loop and remove-worktree, and folds their state", async () => {
    const stateFile = join(mkdtempSync(join(tmpdir(), "cj-mg-")), "state.json");
    let handlers: LinkHandlers | null = null;
    const link: HostLink = {
      publish: () => {},
      projectState: () => {},
      detail: () => {},
      close: () => {},
    };
    const wts = fakeWorktreeDeps({ pid: 4243 });
    const controller = new AbortController();
    const porcelain =
      "worktree /p/web\nbranch refs/heads/main\n\n" +
      `worktree ${X.path}\nbranch refs/heads/plan-x\n`;
    const run = runService({
      backend: "bg",
      launcherFor: () => fakeLauncher(),
      worktrees: wts,
      detail: fakeDetailDeps({
        worktrees: { "/p/web": porcelain },
        stamps: { [X.path]: { name: "plan-x", port: 0, milestone: "plan-x" } },
        milestones: {
          "o/web": [{ ...plan, openIssues: 1, closedIssues: 0 }],
        },
      }),
      conf: { projectsDir: "/p", user: "u", monitor: null },
      stateFile,
      intervalMs: 60_000,
      once: false,
      signal: controller.signal,
      log: () => {},
      scan: () => [
        {
          name: "web",
          path: "/p/web",
          git: "dir",
          jarrinYml: "backlog:\n  repo: o/web\n",
        },
      ],
      connect: (h) => {
        handlers = h;
        return link;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    const h = handlers as LinkHandlers | null;
    if (!h) throw new Error("not connected");
    await h.onCommand({ type: "open-project", project: "web" });

    expect(await h.onCommand(resume)).toEqual({ ok: true });
    expect(wts.loops[0]?.milestone).toEqual(plan);
    expect(readState(stateFile).loops).toMatchObject([
      { worktree: "plan-x", pid: 4243 },
    ]);

    expect(await h.onCommand(remove)).toEqual({ ok: true });
    expect(wts.removed).toEqual([
      { repoRoot: "/p/web", opts: { name: "plan-x" } },
    ]);
    expect(readState(stateFile).loops).toEqual([]);

    controller.abort();
    await run;
  });
});
