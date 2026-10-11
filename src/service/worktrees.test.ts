import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { HostLink } from "./link.js";
import type { LinkHandlers } from "./run.js";
import { runService } from "./run.js";
import type { ProjectDetail } from "../../monitor/shared/protocol.js";
import {
  commandTimeoutMs,
  loopsFor,
  worktreeNameFor,
} from "../../monitor/shared/protocol.js";
import { fakeLauncher } from "../session/fake-launcher.js";
import type { FakeLauncher } from "../session/fake-launcher.js";
import { fakeDetailDeps } from "./fake-detail.js";
import type { FakeWorktrees } from "./fake-worktrees.js";
import { fakeWorktreeDeps } from "./fake-worktrees.js";
import type { LoopRecord, ServiceState } from "./state.js";
import { emptyState, readState } from "./state.js";
import type { CreateWorktreeCommand } from "./worktrees.js";
import {
  createWorktreeFor,
  loopPidFor,
  planCreate,
  pruneLoops,
  withCreated,
} from "./worktrees.js";

const now = new Date(1000);
const plan = { id: 7, title: "plan-Claudjar Service" };

const state = (
  over: { active?: boolean; backlogRepo?: string; loops?: LoopRecord[] } = {},
): ServiceState => ({
  ...emptyState(),
  projects: [
    {
      name: "web",
      path: "/p/web",
      configured: true,
      backlogRepo: over.backlogRepo ?? "o/web",
      active: over.active ?? true,
    },
  ],
  loops: over.loops ?? [],
});

const cmd = (
  over: Partial<CreateWorktreeCommand> = {},
): CreateWorktreeCommand => ({
  type: "create-worktree",
  project: "web",
  mode: "loop",
  milestone: plan,
  ...over,
});

const loopRecord = (over: Partial<LoopRecord> = {}): LoopRecord => ({
  project: "web",
  worktree: "plan-claudjar-service",
  cwd: "/p/web-worktrees/plan-claudjar-service",
  milestone: plan,
  pid: 99,
  log: "",
  startedAt: "",
  ...over,
});

const deps = (
  fake: FakeWorktrees = {},
  alive: readonly number[] = [],
  launcher: FakeLauncher = fakeLauncher(),
) => {
  const wt = fakeWorktreeDeps(fake);
  return {
    wt,
    launcher,
    deps: {
      ...wt,
      isAlive: (pid: number) => alive.includes(pid),
      session: { backend: "bg" as const, launcherFor: () => launcher, now },
    },
  };
};

describe("worktreeNameFor", () => {
  it("slugs a milestone title into a worktree name", () => {
    expect(worktreeNameFor("plan-claudjar-service")).toBe(
      "plan-claudjar-service",
    );
    expect(worktreeNameFor("Plan: Claudjar  Service!")).toBe(
      "plan-claudjar-service",
    );
    expect(worktreeNameFor("--v1.2 release--")).toBe("v1-2-release");
    expect(worktreeNameFor("!!!")).toBe("");
    expect(worktreeNameFor("x".repeat(80))).toHaveLength(48);
  });
});

describe("planCreate", () => {
  const { deps: d } = deps();

  it("derives the name from the milestone, or takes the one given", () => {
    expect(planCreate(state(), cmd(), d)).toMatchObject({
      ok: true,
      name: "plan-claudjar-service",
      milestone: plan,
      mode: "loop",
    });
    expect(planCreate(state(), cmd({ name: " mine " }), d)).toMatchObject({
      ok: true,
      name: "mine",
    });
  });

  it.each<[string, ServiceState, CreateWorktreeCommand, string]>([
    [
      "an unknown project",
      state(),
      cmd({ project: "nope" }),
      "no project named 'nope'",
    ],
    [
      "a closed project",
      state({ active: false }),
      cmd(),
      "open project 'web' first",
    ],
    [
      "a loop without a milestone",
      state(),
      { type: "create-worktree", project: "web", mode: "loop", name: "x" },
      "a loop needs a milestone to work",
    ],
    [
      "a loop without a backlog repo",
      state({ backlogRepo: "" }),
      cmd(),
      "project 'web' has no backlog repo for a loop to work",
    ],
    [
      "a session with neither name nor milestone",
      state(),
      { type: "create-worktree", project: "web", mode: "session" },
      "name the worktree, or pick a milestone to name it after",
    ],
    [
      "a title that yields no name",
      state(),
      cmd({ milestone: { id: 1, title: "!!!" } }),
      'cannot derive a worktree name from "!!!" — name it',
    ],
    [
      "an invalid name",
      state(),
      cmd({ name: "-x" }),
      "name must not start with '-'",
    ],
  ])("refuses %s", (_, s, c, error) => {
    expect(planCreate(s, c, d)).toEqual({ ok: false, error });
  });

  it("refuses a milestone a recorded loop still works", () => {
    const { deps: live } = deps({}, [99]);
    expect(planCreate(state({ loops: [loopRecord()] }), cmd(), live)).toEqual({
      ok: false,
      error:
        'milestone "plan-Claudjar Service" is already worked by a loop in worktree plan-claudjar-service (pid 99)',
    });
    // A dead loop's record does not block it.
    expect(planCreate(state({ loops: [loopRecord()] }), cmd(), d).ok).toBe(
      true,
    );
  });

  it("refuses a milestone whose lock another loop holds", () => {
    const { deps: held } = deps({ holders: { "o/web#7": 1234 } });
    expect(planCreate(state(), cmd(), held)).toEqual({
      ok: false,
      error:
        'milestone "plan-Claudjar Service" is already worked by a loop (pid 1234)',
    });
    // Only a loop needs the milestone to itself.
    expect(planCreate(state(), cmd({ mode: "session" }), held).ok).toBe(true);
  });
});

describe("createWorktreeFor", () => {
  it("loop mode: stamps the milestone and starts a loop for it in the worktree", async () => {
    const { wt, launcher, deps: d } = deps({ pid: 555 });
    const res = await createWorktreeFor(() => state(), cmd(), d);
    expect(wt.created).toEqual([
      {
        repoRoot: "/p/web",
        opts: { name: "plan-claudjar-service", milestone: plan.title },
      },
    ]);
    expect(wt.loops).toEqual([
      {
        cwd: "/p/web-worktrees/plan-claudjar-service",
        repo: "o/web",
        milestone: plan,
        label: "web/plan-claudjar-service",
      },
    ]);
    expect(launcher.calls).toEqual([]);
    expect(res).toMatchObject({
      ok: true,
      name: "plan-claudjar-service",
      session: null,
      loop: {
        project: "web",
        worktree: "plan-claudjar-service",
        milestone: plan,
        pid: 555,
        log: "/logs/web/plan-claudjar-service.log",
      },
    });
  });

  it("session mode: starts a background session named <project>/<worktree>", async () => {
    const { wt, launcher, deps: d } = deps();
    const res = await createWorktreeFor(
      () => state(),
      cmd({ mode: "session", name: "dev" }),
      d,
    );
    expect(wt.loops).toEqual([]);
    expect(launcher.calls).toEqual(["start web--dev /p/web-worktrees/dev"]);
    expect(wt.created[0]?.opts).toEqual({ name: "dev", milestone: plan.title });
    expect(res).toMatchObject({
      ok: true,
      loop: null,
      session: {
        name: "web--dev",
        label: "web/dev",
        worktree: "dev",
        cwd: "/p/web-worktrees/dev",
        status: "running",
      },
    });
  });

  it("session mode without a milestone stamps none", async () => {
    const { wt, deps: d } = deps();
    await createWorktreeFor(
      () => state(),
      { type: "create-worktree", project: "web", mode: "session", name: "x" },
      d,
    );
    expect(wt.created[0]?.opts).toEqual({ name: "x" });
  });

  it("creates nothing for an invalid request", async () => {
    const { wt, deps: d } = deps({ holders: { "o/web#7": 1 } });
    expect((await createWorktreeFor(() => state(), cmd(), d)).ok).toBe(false);
    expect(wt.created).toEqual([]);
  });

  it("reports a failed create, and where it left the worktree", async () => {
    const { wt, deps: d } = deps({
      createError: "setup failed",
      leftAt: "/p/web-worktrees/x",
    });
    expect(await createWorktreeFor(() => state(), cmd(), d)).toEqual({
      ok: false,
      error: "setup failed (the worktree was left at /p/web-worktrees/x)",
    });
    expect(wt.loops).toEqual([]);
  });

  it("checks the milestone again after the create, for a loop started meanwhile", async () => {
    let s = state();
    const { wt, deps: d } = deps({}, [77]);
    const create = d.create;
    const res = await createWorktreeFor(() => s, cmd(), {
      ...d,
      create: (root, opts) => {
        s = state({ loops: [loopRecord({ worktree: "other", pid: 77 })] });
        return create(root, opts);
      },
    });
    expect(res).toEqual({
      ok: false,
      error:
        "worktree plan-claudjar-service was created at /p/web-worktrees/plan-claudjar-service, " +
        'but milestone "plan-Claudjar Service" is already worked by a loop in worktree other (pid 77)',
    });
    expect(wt.loops).toEqual([]);
  });

  it("surfaces a loop that would not start (its lock taken in a race)", async () => {
    const { deps: d } = deps({
      loopError:
        'the loop exited at once (code 1): loop: milestone "plan-Claudjar Service" is already being worked by another loop (pid 8)',
    });
    const res = await createWorktreeFor(() => state(), cmd(), d);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(
      /^worktree plan-claudjar-service was created at .*, but its loop did not start: the loop exited at once/,
    );
  });

  it("surfaces a session that would not start", async () => {
    const launcher = fakeLauncher();
    const { deps: d } = deps({}, [], {
      ...launcher,
      start: () => {
        throw new Error("Workspace not trusted");
      },
    });
    expect(
      await createWorktreeFor(
        () => state(),
        cmd({ mode: "session", name: "dev" }),
        d,
      ),
    ).toEqual({
      ok: false,
      error:
        "worktree dev was created at /p/web-worktrees/dev, but its session did not start: Workspace not trusted",
    });
  });
});

describe("loop records", () => {
  it("withCreated replaces a worktree's record; pruneLoops drops dead loops", async () => {
    const { deps: d } = deps({ pid: 5 });
    const res = await createWorktreeFor(() => state(), cmd(), d);
    if (!res.ok) throw new Error(res.error);
    const before = state({ loops: [loopRecord({ pid: 1 })] });
    const next = withCreated(before, res, now);
    expect(next.loops.map((l) => l.pid)).toEqual([5]);
    expect(
      loopPidFor(next.loops, "web", "plan-claudjar-service", () => true),
    ).toBe(5);
    expect(
      loopPidFor(next.loops, "web", "plan-claudjar-service", () => false),
    ).toBe(0);

    const pruned = pruneLoops(
      state({
        loops: [loopRecord({ pid: 1 }), loopRecord({ worktree: "b", pid: 2 })],
      }),
      (pid) => pid === 2,
    );
    expect(pruned.state.loops.map((l) => l.pid)).toEqual([2]);
    expect(pruned.notes).toEqual([
      "loop web/plan-claudjar-service (pid 1) is gone",
    ]);
  });
});

describe("loopsFor", () => {
  const inst = (id: string, pid: number, title: string) => ({
    id,
    host: "h",
    repo: "o/web",
    pid,
    milestones: [{ id: 7, title }],
  });
  const instances = [inst("a", 10, "m"), inst("b", 20, "m")];

  it("pins the worktree to its own loop by pid", () => {
    expect(
      loopsFor(instances, "h", "o/web", { milestone: "m", loopPid: 20 }).map(
        (i) => i.id,
      ),
    ).toEqual(["b"]);
  });

  it("falls back to the milestone when the pinned loop is not connected", () => {
    expect(
      loopsFor(instances, "h", "o/web", { milestone: "m", loopPid: 30 }).map(
        (i) => i.id,
      ),
    ).toEqual(["a", "b"]);
    expect(
      loopsFor(instances, "other", "o/web", { milestone: "m", loopPid: 20 }),
    ).toEqual([]);
  });
});

describe("commandTimeoutMs", () => {
  it("gives create-worktree time for its setup", () => {
    expect(commandTimeoutMs({ type: "open-project", project: "x" })).toBe(
      60_000,
    );
    expect(commandTimeoutMs(cmd())).toBe(15 * 60_000);
  });
});

describe("runService: create-worktree", () => {
  it("dispatches the command, records the loop and publishes the pinned worktree", async () => {
    const stateFile = join(mkdtempSync(join(tmpdir(), "cj-wt-")), "state.json");
    const details: ProjectDetail[] = [];
    let handlers: LinkHandlers | null = null;
    const link: HostLink = {
      publish: () => {},
      projectState: () => {},
      detail: (d) => details.push(d),
      close: () => {},
    };
    const wt = fakeWorktreeDeps({ pid: 4242 });
    const controller = new AbortController();
    const porcelain =
      "worktree /p/web\nbranch refs/heads/main\n\n" +
      "worktree /p/web-worktrees/plan-claudjar-service\nbranch refs/heads/plan-claudjar-service\n";
    const run = runService({
      backend: "bg",
      launcherFor: () => fakeLauncher(),
      worktrees: wt,
      detail: fakeDetailDeps({
        worktrees: { "/p/web": porcelain },
        stamps: {
          "/p/web-worktrees/plan-claudjar-service": {
            name: "plan-claudjar-service",
            port: 0,
            milestone: plan.title,
          },
        },
        alive: [4242],
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

    expect(await h.onCommand(cmd())).toEqual({
      ok: false,
      error: "open project 'web' first",
    });
    await h.onCommand({ type: "open-project", project: "web" });
    expect(await h.onCommand(cmd())).toEqual({ ok: true });
    expect(readState(stateFile).loops).toMatchObject([
      { worktree: "plan-claudjar-service", pid: 4242 },
    ]);
    await new Promise((r) => setTimeout(r, 0));
    expect(details.at(-1)?.worktrees[1]).toMatchObject({
      name: "plan-claudjar-service",
      milestone: plan.title,
      loopPid: 4242,
    });
    // The loop now holds the milestone: a second one is refused.
    expect(await h.onCommand(cmd({ name: "again" }))).toEqual({
      ok: false,
      error:
        'milestone "plan-Claudjar Service" is already worked by a loop in worktree plan-claudjar-service (pid 4242)',
    });
    expect(wt.loops).toHaveLength(1);

    controller.abort();
    await run;
  });
});
