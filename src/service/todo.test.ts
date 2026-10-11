import { describe, expect, it } from "vitest";

import type { WorktreeDetail } from "../../monitor/shared/protocol.js";
import type { Issue, MilestoneCounts } from "../loop/gitea.js";
import type { ProjectState, ServiceState } from "./state.js";
import { emptyState } from "./state.js";
import type { TodoDeps, TodoMemory } from "./todo.js";
import { TODO_IDLE_MS, freshMemory, hasNewWork, tickTodo } from "./todo.js";

const project: ProjectState = {
  name: "app",
  path: "/p/app",
  configured: true,
  backlogRepo: "o/app",
  active: true,
};

const todoCheckout: WorktreeDetail = {
  name: "todo",
  branch: "todo",
  path: "/p/app-worktrees/todo",
  port: 8001,
  milestone: "todo",
  session: "none",
  loopPid: 0,
};

const issue = (n: number): Issue => ({ number: n, title: `t${String(n)}` });

interface Fake {
  milestones?: MilestoneCounts[];
  open?: Issue[];
  checkouts?: WorktreeDetail[];
  holder?: number | null;
  alive?: readonly number[];
  now?: number;
  stackErr?: string | null;
}

function fake(f: Fake = {}) {
  const calls: string[] = [];
  const deps: TodoDeps = {
    milestones: () =>
      Promise.resolve(
        f.milestones ?? [
          { id: 7, title: "todo", openIssues: 0, closedIssues: 0 },
        ],
      ),
    createMilestone: (repo, title) => {
      calls.push(`createMilestone ${repo} ${title}`);
      return Promise.resolve({ id: 9, title });
    },
    openIssues: () => Promise.resolve(f.open ?? []),
    checkouts: () => f.checkouts ?? [],
    create: (root, opts) => {
      calls.push(`create ${root} ${opts.name} ${opts.milestone ?? ""}`);
      return Promise.resolve({
        ok: true,
        name: opts.name,
        path: "/p/app-worktrees/todo",
        port: 8001,
        milestone: opts.milestone ?? "",
      });
    },
    stack: (cwd, which) => {
      calls.push(`stack ${which} ${cwd}`);
      return Promise.resolve(f.stackErr ?? null);
    },
    startLoop: (spec) => {
      calls.push(
        `loop ${spec.repo} ${String(spec.milestone.id)} ${spec.label}`,
      );
      return Promise.resolve({ pid: 42, log: "/l/app--todo.log" });
    },
    loopHolder: () => f.holder ?? null,
    isAlive: (pid) => f.alive?.includes(pid) ?? false,
    now: () => f.now ?? 1_000_000,
  };
  return { deps, calls };
}

const state = (over: Partial<ServiceState> = {}): ServiceState => ({
  ...emptyState(),
  projects: [project],
  ...over,
});

describe("hasNewWork", () => {
  const mem = (over: Partial<TodoMemory>): TodoMemory => ({
    ...freshMemory,
    ...over,
  });

  it("is false with no tickets, whatever else", () => {
    expect(hasNewWork([], mem({ poked: true }))).toBe(false);
  });

  it("is true before the first loop, after a poke, or for an unseen ticket", () => {
    expect(hasNewWork([issue(1)], mem({ seen: null }))).toBe(true);
    expect(hasNewWork([issue(1)], mem({ seen: [1], poked: true }))).toBe(true);
    expect(hasNewWork([issue(1), issue(2)], mem({ seen: [1] }))).toBe(true);
  });

  it("is false when every open ticket was handed to the last loop", () => {
    expect(hasNewWork([issue(1)], mem({ seen: [1, 2] }))).toBe(false);
  });
});

describe("tickTodo", () => {
  it("creates the todo milestone when the repo has none", async () => {
    const { deps, calls } = fake({ milestones: [] });
    const tick = await tickTodo(state(), project, freshMemory, deps);
    expect(calls).toEqual(["createMilestone o/app todo"]);
    expect(tick.notes).toEqual(['created milestone "todo" in o/app']);
    expect(tick.loop).toBeNull();
  });

  it("creates the worktree, starts the stack and a loop for a new ticket", async () => {
    const { deps, calls } = fake({ open: [issue(3)] });
    const tick = await tickTodo(state(), project, freshMemory, deps);
    expect(calls).toEqual([
      "create /p/app todo todo",
      "stack start /p/app-worktrees/todo",
      "loop o/app 7 app/todo",
    ]);
    expect(tick.loop).toMatchObject({
      project: "app",
      worktree: "todo",
      pid: 42,
      milestone: { id: 7, title: "todo" },
    });
    expect(tick.memory).toEqual({
      stackUp: true,
      idleSince: null,
      seen: [3],
      poked: false,
    });
  });

  it("reuses an existing todo worktree", async () => {
    const { deps, calls } = fake({
      open: [issue(3)],
      checkouts: [todoCheckout],
    });
    await tickTodo(state(), project, freshMemory, deps);
    expect(calls[0]).toBe("stack start /p/app-worktrees/todo");
  });

  it("leaves a live loop alone, recorded or holding the lock", async () => {
    const recorded = state({
      loops: [
        {
          project: "app",
          worktree: "todo",
          cwd: todoCheckout.path,
          milestone: { id: 7, title: "todo" },
          pid: 5,
          log: "",
          startedAt: "",
        },
      ],
    });
    for (const [s, f] of [
      [recorded, { alive: [5] }],
      [state(), { holder: 77 }],
    ] as const) {
      const { deps, calls } = fake({ ...f, open: [issue(3)] });
      const tick = await tickTodo(s, project, freshMemory, deps);
      expect(calls).toEqual([]);
      expect(tick.memory.idleSince).toBeNull();
    }
  });

  it("does not retry tickets the last loop left open", async () => {
    const { deps, calls } = fake({
      open: [issue(3)],
      checkouts: [todoCheckout],
    });
    const memory = { ...freshMemory, seen: [3] };
    const tick = await tickTodo(state(), project, memory, deps);
    expect(calls).toEqual([]);
    expect(tick.memory.idleSince).toBe(1_000_000);
  });

  it("stops the stack after the idle time, and not before", async () => {
    const idle = { ...freshMemory, seen: [], idleSince: 0 };
    const early = fake({ checkouts: [todoCheckout], now: TODO_IDLE_MS - 1 });
    expect(
      (await tickTodo(state(), project, idle, early.deps)).memory.stackUp,
    ).toBe(true);
    expect(early.calls).toEqual([]);

    const late = fake({ checkouts: [todoCheckout], now: TODO_IDLE_MS });
    const tick = await tickTodo(state(), project, idle, late.deps);
    expect(late.calls).toEqual(["stack exit /p/app-worktrees/todo"]);
    expect(tick.memory.stackUp).toBe(false);
    expect(tick.notes).toEqual(["todo stack of app stopped (idle)"]);

    const again = fake({ checkouts: [todoCheckout], now: TODO_IDLE_MS * 2 });
    await tickTodo(state(), project, tick.memory, again.deps);
    expect(again.calls).toEqual([]);
  });

  it("keeps the poke when the stack fails to start, so the next tick retries", async () => {
    const { deps, calls } = fake({
      open: [issue(3)],
      checkouts: [todoCheckout],
      stackErr: "`docker compose up -d` exited 1",
    });
    const tick = await tickTodo(state(), project, freshMemory, deps);
    expect(calls).toEqual(["stack start /p/app-worktrees/todo"]);
    expect(tick.loop).toBeNull();
    expect(tick.memory.poked).toBe(true);
  });
});
