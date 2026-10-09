import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  acquireLock,
  acquireLocks,
  backlogRepo,
  loopLocks,
} from "../commands/loop.js";
import { parseQuestion, runLoop } from "./driver.js";
import type { LoopStore, RunClaude } from "./driver.js";
import {
  LOOP_MARKER_PREFIX,
  giteaClient,
  resolveAuth,
  workOrder,
} from "./gitea.js";
import type { GiteaClient, Issue, Milestone } from "./gitea.js";
import { InputBox, withNotes } from "./input.js";
import { parseSteps } from "./progress.js";
import type { Entry } from "./progress.js";
import { pushBranch } from "./repo.js";
import { FALLBACK_WAIT_MS, StreamTracker, limitWaitMs } from "./stream.js";
import type { RunOutcome } from "./stream.js";

const issue = (number: number, title = `Issue ${String(number)}`): Issue => ({
  number,
  title,
});

describe("workOrder", () => {
  it("runs stages by their number, then the rest oldest first", () => {
    const ordered = workOrder([
      issue(9, "Stage 3 — c"),
      issue(4, "caveat: x"),
      issue(7, "Stage 1 — a"),
      issue(2, "todo"),
      issue(8, "Stage 2 — b"),
    ]);
    expect(ordered.map((i) => i.number)).toEqual([7, 8, 9, 2, 4]);
  });
});

describe("resolveAuth", () => {
  it("prefers the environment", () => {
    expect(
      resolveAuth({ GITEA_HOST: "https://g/", GITEA_ACCESS_TOKEN: "t" }, null),
    ).toEqual({ host: "https://g", token: "t" });
  });

  it("falls back to the gitea MCP server's env", () => {
    const json = JSON.stringify({
      mcpServers: {
        gitea: { env: { GITEA_HOST: "https://h", GITEA_ACCESS_TOKEN: "x" } },
      },
    });
    expect(resolveAuth({}, json)).toEqual({ host: "https://h", token: "x" });
  });

  it("is null when nothing is configured", () => {
    expect(resolveAuth({}, "{}")).toBeNull();
    expect(resolveAuth({}, "not json")).toBeNull();
  });
});

describe("giteaClient", () => {
  const auth = { host: "https://g", token: "t" };
  const respond = (body: unknown): Promise<Response> =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

  it("matches a milestone title exactly, not by substring", async () => {
    const client = giteaClient(auth, "o/r", () =>
      respond([
        { id: 1, title: "feature-a-2" },
        { id: 2, title: "feature-a" },
      ]),
    );
    await expect(client.resolveMilestone("feature-a")).resolves.toEqual({
      id: 2,
      title: "feature-a",
    });
  });

  it("refuses an ambiguous title", async () => {
    const client = giteaClient(auth, "o/r", () =>
      respond([
        { id: 1, title: "x" },
        { id: 2, title: "x" },
      ]),
    );
    await expect(client.resolveMilestone("x")).rejects.toThrow(
      /2 open milestones/,
    );
  });

  it("pages until a short page", async () => {
    const urls: string[] = [];
    const full = Array.from({ length: 50 }, (_, n) => ({
      number: n + 1,
      title: "t",
    }));
    const client = giteaClient(auth, "o/r", (url) => {
      urls.push(url);
      return respond(urls.length === 1 ? full : [{ number: 99, title: "t" }]);
    });
    const issues = await client.openIssues({ id: 5, title: "m" });
    expect(issues).toHaveLength(51);
    expect(urls[1]).toContain("milestones=5");
    expect(urls[1]).toContain("page=2");
  });

  it("never lists an older loop's own tickets as work", async () => {
    const client = giteaClient(auth, "o/r", () =>
      respond([
        { number: 1, title: "work" },
        {
          number: 2,
          title: "Open questions",
          body: `${LOOP_MARKER_PREFIX}questions -->\n…`,
        },
      ]),
    );
    const issues = await client.openIssues({ id: 5, title: "m" });
    expect(issues.map((i) => i.number)).toEqual([1]);
  });
});

describe("parseQuestion", () => {
  it("reads the block a session ends on", () => {
    expect(
      parseQuestion(
        "Done some.\n\n<<<QUESTION\nA or B?\nI'd pick A.\nQUESTION>>>",
      ),
    ).toBe("A or B?\nI'd pick A.");
  });

  it("is null without one", () => {
    expect(parseQuestion("Blocked: no access.")).toBeNull();
    expect(parseQuestion("<<<QUESTION\n\nQUESTION>>>")).toBeNull();
  });
});

describe("StreamTracker", () => {
  const feedAll = (lines: unknown[], code: number | null): RunOutcome => {
    const t = new StreamTracker();
    for (const l of lines) t.feed(JSON.stringify(l));
    return t.outcome(code);
  };

  it("reports a clean run", () => {
    const o = feedAll(
      [
        { type: "system", subtype: "init", session_id: "s1" },
        { type: "result", is_error: false, result: "done", session_id: "s1" },
      ],
      0,
    );
    expect(o).toMatchObject({
      sessionId: "s1",
      limited: false,
      isError: false,
    });
  });

  it("detects a rejected rate limit and its reset", () => {
    const o = feedAll(
      [
        { type: "system", session_id: "s2" },
        {
          type: "rate_limit_event",
          rate_limit_info: { status: "rejected", resetsAt: 1_800_000_000 },
        },
        { type: "result", is_error: true, result: "You've hit your limit" },
      ],
      1,
    );
    expect(o).toMatchObject({
      sessionId: "s2",
      limited: true,
      resetsAt: 1_800_000_000,
    });
  });

  it("ignores a warning-level rate limit event on a successful run", () => {
    const o = feedAll(
      [
        {
          type: "rate_limit_event",
          rate_limit_info: { status: "allowed_warning" },
        },
        { type: "result", is_error: false, result: "ok" },
      ],
      0,
    );
    expect(o.limited).toBe(false);
  });

  it("parses the legacy `limit reached|<epoch>` text", () => {
    const o = feedAll(
      [
        {
          type: "result",
          is_error: true,
          result: "Claude AI usage limit reached|1800000000000",
        },
      ],
      1,
    );
    expect(o).toMatchObject({ limited: true, resetsAt: 1_800_000_000 });
  });

  it("does not call an ordinary failure a limit", () => {
    const o = feedAll([{ type: "result", is_error: true, result: "boom" }], 1);
    expect(o).toMatchObject({ limited: false, isError: true });
  });
});

describe("limitWaitMs", () => {
  it("waits until the reset plus a margin", () => {
    expect(limitWaitMs(1000, 0)).toBe(1_000_000 + 60_000);
  });
  it("never waits less than a minute, and falls back without a reset", () => {
    expect(limitWaitMs(1, 10_000_000)).toBe(60_000);
    expect(limitWaitMs(null, 0)).toBe(FALLBACK_WAIT_MS);
  });
});

describe("backlogRepo", () => {
  it("prefers the plan section's repo", () => {
    expect(backlogRepo("backlog:\n  repo: a/b\n  plan:\n    repo: c/d\n")).toBe(
      "c/d",
    );
    expect(backlogRepo("backlog:\n  repo: a/b\n")).toBe("a/b");
    expect(backlogRepo("")).toBe("");
  });
});

describe("runLoop", () => {
  const ok = (sessionId: string): RunOutcome => ({
    sessionId,
    limited: false,
    resetsAt: null,
    isError: false,
    resultText: "",
  });

  function fakeGitea(byMilestone: Record<number, Issue[]>): {
    client: GiteaClient;
    close: (n: number) => void;
  } {
    const closed = new Set<number>();
    return {
      close: (n) => void closed.add(n),
      client: {
        resolveMilestone: () => Promise.reject(new Error("unused")),
        openIssues: (m) =>
          Promise.resolve(
            (byMilestone[m.id] ?? []).filter((i) => !closed.has(i.number)),
          ),
        isClosed: (n) => Promise.resolve(closed.has(n)),
      },
    };
  }

  interface FakeStore extends LoopStore {
    /** Latest saved entries per milestone id. */
    readonly boards: Map<number, readonly Entry[]>;
    /** Every ask, in order. */
    readonly asked: { id: string; issue: number; text: string }[];
    readonly resolved: string[];
    readonly statuses: string[];
    /** The user answers question `id`. */
    reply(id: string, text: string): void;
    setPaused(p: boolean): void;
    /** Called on every wait, before it returns. */
    onWait: () => void;
  }

  function fakeStore(stored: Record<number, Entry[]> = {}): FakeStore {
    const answers = new Map<string, string | null>();
    let paused = false;
    let n = 0;
    const store: FakeStore = {
      boards: new Map(),
      asked: [],
      resolved: [],
      statuses: [],
      onWait: () => {},
      stored: (m) => stored[m.id] ?? [],
      save: (m, entries) => void store.boards.set(m.id, [...entries]),
      ask: (_m, i, text) => {
        const id = `q${String(++n)}`;
        store.asked.push({ id, issue: i.number, text });
        answers.set(id, null);
        return id;
      },
      question: (id) =>
        answers.has(id) ? { answer: answers.get(id) ?? null } : null,
      resolve: (id) => {
        answers.delete(id);
        store.resolved.push(id);
      },
      paused: () => paused,
      wait: () => {
        store.onWait();
        return Promise.resolve();
      },
      status: (t) => void store.statuses.push(t),
      reply: (id, text) => void answers.set(id, text),
      setPaused: (p) => (paused = p),
    };
    for (const entries of Object.values(stored))
      for (const e of entries)
        if (e.questionId) answers.set(e.questionId, null);
    return store;
  }

  const quiet = {
    sleep: () => Promise.resolve(),
    now: () => 0,
    log: () => {},
    stash: () => Promise.resolve(false),
  };
  const asks = (sessionId: string, q: string): RunOutcome => ({
    ...ok(sessionId),
    resultText: `<<<QUESTION\n${q}\nQUESTION>>>`,
  });

  const m1: Milestone = { id: 1, title: "one" };
  const m2: Milestone = { id: 2, title: "two" };
  const base = { repo: "o/r", maxIssues: 0, maxFailures: 3, pollMs: 1000 };

  it("works milestones in order, one fresh session per issue", async () => {
    const g = fakeGitea({ 1: [issue(3), issue(1)], 2: [issue(2)] });
    const calls: [number, string | null][] = [];
    const run: RunClaude = (_p, resume, i) => {
      calls.push([i.number, resume]);
      g.close(i.number);
      return Promise.resolve(ok(`s${String(i.number)}`));
    };
    const summary = await runLoop(
      { ...quiet, gitea: g.client, run, store: fakeStore() },
      { ...base, milestones: [m1, m2] },
    );
    expect(calls).toEqual([
      [1, null],
      [3, null],
      [2, null],
    ]);
    expect(summary.closed.map((i) => i.number)).toEqual([1, 3, 2]);
    expect(summary.stopReason).toBe("no open issues left");
    expect(summary.clean).toBe(true);
  });

  it("waits out a usage limit and resumes the same session", async () => {
    const g = fakeGitea({ 1: [issue(1)] });
    const calls: (string | null)[] = [];
    const sleeps: number[] = [];
    const run: RunClaude = (_p, resume, i) => {
      calls.push(resume);
      if (calls.length === 1) {
        return Promise.resolve({
          ...ok("sess"),
          limited: true,
          isError: true,
          resetsAt: 100,
        });
      }
      g.close(i.number);
      return Promise.resolve(ok("sess"));
    };
    await runLoop(
      {
        ...quiet,
        gitea: g.client,
        run,
        store: fakeStore(),
        sleep: (ms) => {
          sleeps.push(ms);
          return Promise.resolve();
        },
        now: () => 40_000,
      },
      { ...base, milestones: [m1] },
    );
    expect(calls).toEqual([null, "sess"]);
    expect(sleeps).toEqual([100_000 - 40_000 + 60_000]);
  });

  it("skips an issue left open and stops after too many in a row", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2), issue(3)] });
    const run: RunClaude = () => Promise.resolve(ok("s"));
    const store = fakeStore();
    const summary = await runLoop(
      { ...quiet, gitea: g.client, run, store },
      { ...base, maxFailures: 2, milestones: [m1] },
    );
    expect(summary.leftOpen.map((i) => i.number)).toEqual([1, 2]);
    expect(summary.stopReason).toMatch(/2 issues in a row/);
    expect(summary.clean).toBe(false);
    expect(store.boards.get(1)?.map((e) => e.status)).toEqual([
      "blocked",
      "blocked",
      "open",
    ]);
  });

  it("honours --max-issues", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2)] });
    const run: RunClaude = (_p, _r, i) => {
      g.close(i.number);
      return Promise.resolve(ok("s"));
    };
    const summary = await runLoop(
      { ...quiet, gitea: g.client, run, store: fakeStore() },
      { ...base, maxIssues: 1, milestones: [m1] },
    );
    expect(summary.closed).toHaveLength(1);
    expect(summary.clean).toBe(false);
  });

  it("parks a question, works on, and resumes the session with the answer", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2)] });
    const store = fakeStore();
    const calls: [number, string | null, string][] = [];
    let stashes = 0;
    const run: RunClaude = (prompt, resume, i) => {
      calls.push([i.number, resume, prompt]);
      if (i.number === 1 && resume === null)
        return Promise.resolve(asks("s1", "Drop the column?"));
      if (i.number === 2) store.reply("q1", "Yes, drop it."); // answered while #2 runs
      g.close(i.number);
      return Promise.resolve(ok(`s${String(i.number)}`));
    };
    const summary = await runLoop(
      {
        ...quiet,
        gitea: g.client,
        run,
        store,
        stash: () => {
          stashes++;
          return Promise.resolve(true);
        },
      },
      { ...base, milestones: [m1] },
    );
    expect(calls.map(([n, r]) => [n, r])).toEqual([
      [1, null],
      [2, null],
      [1, "s1"],
    ]);
    expect(calls[2]?.[2]).toContain("> Yes, drop it.");
    expect(calls[2]?.[2]).toContain("git stash pop");
    expect(store.asked).toEqual([
      { id: "q1", issue: 1, text: "Drop the column?" },
    ]);
    expect(store.resolved).toEqual(["q1"]);
    expect(stashes).toBe(1);
    expect(summary.closed.map((i) => i.number)).toEqual([2, 1]);
    expect(summary.awaiting).toEqual([]);
  });

  it("waits on the store while only questions remain", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2)] });
    const store = fakeStore();
    const resumed: number[] = [];
    let waits = 0;
    store.onWait = () => {
      waits++;
      if (waits === 1) store.reply("q2", "yes, go ahead");
      if (waits === 2) store.reply("q1", "no");
    };
    const run: RunClaude = (_p, resume, i) => {
      if (resume === null)
        return Promise.resolve(asks(`s${String(i.number)}`, "?"));
      resumed.push(i.number);
      g.close(i.number);
      return Promise.resolve(ok("s"));
    };
    await runLoop(
      { ...quiet, gitea: g.client, run, store },
      { ...base, milestones: [m1] },
    );
    expect(resumed).toEqual([2, 1]);
    expect(store.statuses).toContain("waiting for answers to #1 #2");
  });

  it("reports an unanswered question as awaiting", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2)] });
    const run: RunClaude = (_p, _r, i) =>
      Promise.resolve(i.number === 1 ? asks("s1", "?") : ok("s2"));
    const summary = await runLoop(
      { ...quiet, gitea: g.client, run, store: fakeStore() },
      { ...base, maxIssues: 2, maxFailures: 1, milestones: [m1] },
    );
    expect(summary.awaiting.map((i) => i.number)).toEqual([1]);
  });

  it("holds while paused and starts no session until resumed", async () => {
    const g = fakeGitea({ 1: [issue(1)] });
    const store = fakeStore();
    store.setPaused(true);
    let waits = 0;
    store.onWait = () => {
      if (++waits === 3) store.setPaused(false);
    };
    const run: RunClaude = (_p, _r, i) => {
      expect(waits).toBe(3);
      g.close(i.number);
      return Promise.resolve(ok("s"));
    };
    const summary = await runLoop(
      { ...quiet, gitea: g.client, run, store },
      { ...base, milestones: [m1] },
    );
    expect(summary.clean).toBe(true);
    expect(store.statuses[0]).toBe("paused");
  });

  it("saves open issues and mirrors a session's steps", async () => {
    const g = fakeGitea({ 1: [issue(1, "Stage 1 — a"), issue(2, "b")] });
    const store = fakeStore();
    const seen: (readonly Entry[] | undefined)[] = [];
    const run: RunClaude = (_p, _r, i, watch) => {
      seen.push(store.boards.get(1));
      watch.session(`s${String(i.number)}`);
      watch.text("<<<STEPS\n- [x] read\n- [ ] write\nSTEPS>>>");
      g.close(i.number);
      return Promise.resolve(ok(`s${String(i.number)}`));
    };
    await runLoop(
      { ...quiet, gitea: g.client, run, store },
      { ...base, milestones: [m1] },
    );
    expect(seen[0]?.map((e) => [e.number, e.status])).toEqual([
      [1, "working"],
      [2, "open"],
    ]);
    expect(store.boards.get(1)?.[0]).toMatchObject({
      status: "closed",
      sessionId: "s1",
      steps: [
        { text: "read", done: true },
        { text: "write", done: false },
      ],
    });
  });

  it("after a restart, resumes an interrupted session and keeps waiting on a question", async () => {
    const entry = (n: number, over: Partial<Entry>): Entry => ({
      number: n,
      title: n === 1 ? "a" : "b",
      status: "open",
      steps: [],
      sessionId: null,
      questionId: null,
      stashed: false,
      ...over,
    });
    const store = fakeStore({
      1: [
        entry(1, {
          status: "waiting",
          sessionId: "s1",
          questionId: "old",
          stashed: true,
        }),
        entry(2, { status: "working", sessionId: "s2" }),
      ],
    });
    const g = fakeGitea({ 1: [issue(1, "a"), issue(2, "b")] });
    const calls: [number, string | null][] = [];
    const run: RunClaude = (prompt, resume, i) => {
      calls.push([i.number, resume]);
      if (i.number === 2) {
        expect(prompt).toContain("was restarted");
        store.reply("old", "go"); // the answer arrives while #2 runs
      } else expect(prompt).toContain("git stash pop");
      g.close(i.number);
      return Promise.resolve(ok("s"));
    };
    await runLoop(
      { ...quiet, gitea: g.client, run, store },
      { ...base, milestones: [m1] },
    );
    expect(calls).toEqual([
      [2, "s2"],
      [1, "s1"],
    ]);
    expect(store.resolved).toEqual(["old"]);
  });

  it("blocks an issue whose question the store no longer knows", async () => {
    const store = fakeStore();
    const lost: Entry = {
      number: 1,
      title: "a",
      status: "waiting",
      steps: [],
      sessionId: "s1",
      questionId: "gone",
      stashed: false,
    };
    const withLost: LoopStore = { ...store, stored: () => [lost] };
    const g = fakeGitea({ 1: [issue(1, "a")] });
    const summary = await runLoop(
      {
        ...quiet,
        gitea: g.client,
        run: () => Promise.reject(new Error("must not run")),
        store: withLost,
      },
      { ...base, milestones: [m1] },
    );
    expect(summary.leftOpen.map((i) => i.number)).toEqual([1]);
    expect(store.boards.get(1)?.[0]?.status).toBe("blocked");
  });
});

describe("parseSteps", () => {
  it("takes the last steps block", () => {
    expect(
      parseSteps(
        "<<<STEPS\n- [ ] a\nSTEPS>>> then <<<STEPS\n- [x] a\n- [ ] b\nSTEPS>>>",
      ),
    ).toEqual([
      { text: "a", done: true },
      { text: "b", done: false },
    ]);
    expect(parseSteps("no block")).toBeNull();
  });
});

describe("InputBox", () => {
  it("holds input until a session attaches, then feeds it live", () => {
    const box = new InputBox();
    box.push("early");
    const live: string[] = [];
    expect(box.attach((t) => live.push(t))).toEqual(["early"]);
    box.push("mid-session");
    box.detach();
    box.push("late");
    expect(live).toEqual(["mid-session"]);
    expect(box.attach(() => {})).toEqual(["late"]);
  });

  it("appends waiting notes to the prompt", () => {
    expect(withNotes("Continue 1", [])).toBe("Continue 1");
    expect(withNotes("Continue 1", ["use v2"])).toContain("> use v2");
  });
});

describe("acquireLock", () => {
  const scratch = (): string => mkdtempSync(join(tmpdir(), "claudjar-lock-"));

  it("creates a missing state directory on the first run", () => {
    const path = join(scratch(), "loop", "owner__repo.lock");
    const release = acquireLock(path, "milestone x");
    expect(typeof release).toBe("function");
    expect(readFileSync(path, "utf8")).toBe(String(process.pid));
    if (typeof release === "function") release();
    expect(existsSync(path)).toBe(false);
  });

  it("refuses while the holder is alive", () => {
    const path = join(scratch(), "owner__repo.lock");
    writeFileSync(path, String(process.pid));
    expect(acquireLock(path, "milestone x")).toMatch(
      /milestone x is already being worked/,
    );
  });

  it("takes over a lock left by a dead process", () => {
    const path = join(scratch(), "owner__repo.lock");
    writeFileSync(path, "999999999");
    expect(typeof acquireLock(path, "milestone x")).toBe("function");
    expect(readFileSync(path, "utf8")).toBe(String(process.pid));
  });
});

describe("acquireLocks", () => {
  const scratch = (): string => mkdtempSync(join(tmpdir(), "claudjar-locks-"));
  const ms = (id: number): Milestone => ({ id, title: `m${String(id)}` });

  it("lets loops in other worktrees on other milestones run side by side", () => {
    const dir = scratch();
    const a = acquireLocks(loopLocks(dir, "/wt/a", [ms(1)]));
    const b = acquireLocks(loopLocks(dir, "/wt/b", [ms(2)]));
    expect(typeof a).toBe("function");
    expect(typeof b).toBe("function");
  });

  it("refuses a milestone another loop holds, and keeps nothing it took", () => {
    const dir = scratch();
    expect(typeof acquireLocks(loopLocks(dir, "/wt/a", [ms(1)]))).toBe(
      "function",
    );
    const mine = loopLocks(dir, "/wt/b", [ms(2), ms(1)]);
    expect(acquireLocks(mine)).toMatch(/milestone "m1"/);
    // The worktree and milestone-2 locks it took first are given back.
    expect(mine.slice(0, 2).filter((l) => existsSync(l.path))).toEqual([]);
  });

  it("refuses a second loop in the same worktree", () => {
    const dir = scratch();
    expect(typeof acquireLocks(loopLocks(dir, "/wt/a", [ms(1)]))).toBe(
      "function",
    );
    expect(acquireLocks(loopLocks(dir, "/wt/a", [ms(2)]))).toMatch(
      /worktree \/wt\/a/,
    );
  });
});

describe("pushBranch", () => {
  const git = (cwd: string, ...args: string[]): string =>
    execFileSync("git", args, { cwd, encoding: "utf8" });

  const clone = (): { work: string; remote: string } => {
    const root = mkdtempSync(join(tmpdir(), "claudjar-push-"));
    const remote = join(root, "remote.git");
    const work = join(root, "work");
    git(root, "init", "--bare", "-b", "main", remote);
    git(root, "init", "-b", "main", work);
    git(
      work,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "--allow-empty",
      "-m",
      "x",
    );
    return { work, remote };
  };

  it("pushes the branch to its upstream", async () => {
    const { work, remote } = clone();
    git(work, "remote", "add", "origin", remote);
    git(work, "push", "-u", "origin", "main");
    git(
      work,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "--allow-empty",
      "-m",
      "y",
    );
    expect(await pushBranch(work)).toBeNull();
    expect(git(remote, "rev-parse", "main")).toBe(
      git(work, "rev-parse", "HEAD"),
    );
  });

  it("returns git's error when there is nowhere to push", async () => {
    const { work } = clone();
    expect(await pushBranch(work)).toMatch(
      /no (upstream|configured push destination)/i,
    );
  });
});
