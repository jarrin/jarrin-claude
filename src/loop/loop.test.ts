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
import type { RunClaude } from "./driver.js";
import { giteaClient, resolveAuth, workOrder } from "./gitea.js";
import { QUESTIONS_MARKER } from "./gitea.js";
import type { Comment, GiteaClient, Issue, Milestone } from "./gitea.js";
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

  it("never lists the open-questions ticket as work", async () => {
    const client = giteaClient(auth, "o/r", () =>
      respond([
        { number: 1, title: "work" },
        { number: 2, title: "Open questions", body: `${QUESTIONS_MARKER}\n…` },
      ]),
    );
    const issues = await client.openIssues({ id: 5, title: "m" });
    expect(issues.map((i) => i.number)).toEqual([1]);
  });

  it("reopens an existing questions ticket instead of filing a second", async () => {
    const calls: [string, string][] = [];
    const client = giteaClient(auth, "o/r", (url, init) => {
      calls.push([init.method ?? "GET", url]);
      return respond(
        init.method === "PATCH"
          ? {}
          : [
              {
                number: 7,
                state: "closed",
                html_url: "https://g/o/r/issues/7",
                body: QUESTIONS_MARKER,
              },
            ],
      );
    });
    await expect(
      client.ensureQuestionsIssue({ id: 5, title: "m" }),
    ).resolves.toEqual({ number: 7, url: "https://g/o/r/issues/7" });
    expect(calls.map(([m]) => m)).toEqual(["GET", "PATCH"]);
    expect(calls[0]?.[1]).toContain("state=all");
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

  const QUESTIONS = 100;

  function fakeGitea(byMilestone: Record<number, Issue[]>): {
    client: GiteaClient;
    close: (n: number) => void;
    closed: Set<number>;
    /** Comments on the questions ticket, in order. */
    thread: Comment[];
    reply: (body: string) => void;
  } {
    const closed = new Set<number>();
    const thread: Comment[] = [];
    let nextId = 1;
    const add = (body: string): Comment => {
      const c = { id: nextId++, body, url: `u#${String(nextId)}` };
      thread.push(c);
      return c;
    };
    return {
      close: (n) => void closed.add(n),
      closed,
      thread,
      reply: (body) => void add(body),
      client: {
        resolveMilestone: () => Promise.reject(new Error("unused")),
        openIssues: (m) =>
          Promise.resolve(
            (byMilestone[m.id] ?? []).filter((i) => !closed.has(i.number)),
          ),
        isClosed: (n) => Promise.resolve(closed.has(n)),
        ensureQuestionsIssue: () => {
          closed.delete(QUESTIONS);
          return Promise.resolve({ number: QUESTIONS, url: "q" });
        },
        closeIssue: (n) => {
          closed.add(n);
          return Promise.resolve();
        },
        comment: (_n, body) => Promise.resolve(add(body)),
        comments: () => Promise.resolve([...thread]),
      },
    };
  }

  const quiet = {
    sleep: () => Promise.resolve(),
    now: () => 0,
    log: () => {},
    stash: () => Promise.resolve(false),
    notify: () => {},
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
      {
        gitea: g.client,
        run,
        ...quiet,
      },
      { ...base, milestones: [m1, m2] },
    );
    expect(calls).toEqual([
      [1, null],
      [3, null],
      [2, null],
    ]);
    expect(summary.closed.map((i) => i.number)).toEqual([1, 3, 2]);
    expect(summary.stopReason).toBe("no open issues left");
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
        gitea: g.client,
        run,
        sleep: (ms) => {
          sleeps.push(ms);
          return Promise.resolve();
        },
        now: () => 40_000,
        log: () => {},
        stash: () => Promise.resolve(false),
        notify: () => {},
      },
      { ...base, milestones: [m1] },
    );
    expect(calls).toEqual([null, "sess"]);
    expect(sleeps).toEqual([100_000 - 40_000 + 60_000]);
  });

  it("skips an issue left open and stops after too many in a row", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2), issue(3)] });
    const run: RunClaude = () => Promise.resolve(ok("s"));
    const summary = await runLoop(
      {
        gitea: g.client,
        run,
        ...quiet,
      },
      { ...base, maxFailures: 2, milestones: [m1] },
    );
    expect(summary.leftOpen.map((i) => i.number)).toEqual([1, 2]);
    expect(summary.stopReason).toMatch(/2 issues in a row/);
  });

  it("honours --max-issues", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2)] });
    const run: RunClaude = (_p, _r, i) => {
      g.close(i.number);
      return Promise.resolve(ok("s"));
    };
    const summary = await runLoop(
      {
        gitea: g.client,
        run,
        ...quiet,
      },
      { ...base, maxIssues: 1, milestones: [m1] },
    );
    expect(summary.closed).toHaveLength(1);
  });

  it("parks a question, works on, and resumes the session with the answer", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2)] });
    const calls: [number, string | null, string][] = [];
    const notified: string[] = [];
    let stashes = 0;
    const run: RunClaude = (prompt, resume, i) => {
      calls.push([i.number, resume, prompt]);
      if (i.number === 1 && resume === null)
        return Promise.resolve(asks("s1", "Drop the column?"));
      if (i.number === 2) g.reply("Yes, drop it."); // answered while #2 runs
      g.close(i.number);
      return Promise.resolve(ok(`s${String(i.number)}`));
    };
    const summary = await runLoop(
      {
        ...quiet,
        gitea: g.client,
        run,
        stash: () => {
          stashes++;
          return Promise.resolve(true);
        },
        notify: (_t, _b, url) => void notified.push(url),
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
    expect(g.thread[0]?.body).toContain("Drop the column?");
    expect(notified).toHaveLength(1);
    expect(stashes).toBe(1);
    expect(summary.closed.map((i) => i.number)).toEqual([2, 1]);
    expect(summary.awaiting).toEqual([]);
    expect(g.closed.has(QUESTIONS)).toBe(true);
  });

  it("routes a reply by its leading #n and polls while only questions remain", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2)] });
    const resumed: number[] = [];
    let polls = 0;
    const run: RunClaude = (_p, resume, i) => {
      if (resume === null)
        return Promise.resolve(asks(`s${String(i.number)}`, "?"));
      resumed.push(i.number);
      g.close(i.number);
      return Promise.resolve(ok("s"));
    };
    await runLoop(
      {
        ...quiet,
        gitea: g.client,
        run,
        sleep: () => {
          polls++;
          if (polls === 1) g.reply("#2 yes, go ahead");
          if (polls === 2) g.reply("and for the other one: no");
          return Promise.resolve();
        },
      },
      { ...base, milestones: [m1] },
    );
    expect(resumed).toEqual([2, 1]);
  });

  it("leaves the questions ticket open while a question is unanswered", async () => {
    const g = fakeGitea({ 1: [issue(1), issue(2)] });
    const run: RunClaude = (_p, _r, i) =>
      Promise.resolve(i.number === 1 ? asks("s1", "?") : ok("s2"));
    const summary = await runLoop(
      { ...quiet, gitea: g.client, run },
      { ...base, maxIssues: 2, maxFailures: 1, milestones: [m1] },
    );
    expect(summary.awaiting.map((i) => i.number)).toEqual([1]);
    expect(g.closed.has(QUESTIONS)).toBe(false);
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
