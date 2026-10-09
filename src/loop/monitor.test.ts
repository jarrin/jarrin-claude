import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentMessage,
  ServerMessage,
} from "../../monitor/shared/protocol.js";
import { agentUrl, connectMonitor, streamLines } from "./monitor.js";
import type { SocketLike } from "./monitor.js";

class FakeSocket implements SocketLike {
  readyState = 0;
  bufferedAmount = 0;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  sent: AgentMessage[] = [];
  send(data: string): void {
    this.sent.push(JSON.parse(data) as AgentMessage);
  }
  close(): void {
    this.readyState = 3;
  }
  accept(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  receive(msg: ServerMessage): void {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(msg) }),
    );
  }
  drop(): void {
    this.readyState = 3;
    this.onclose?.(new Event("close") as CloseEvent);
  }
}

const instance = {
  id: "i1",
  host: "desktop",
  repo: "o/r",
  milestones: [{ id: 4, title: "M" }],
  pid: 1,
  startedAt: 0,
};

describe("agentUrl", () => {
  it("adds the agent path to a bare origin and keeps an explicit one", () => {
    expect(agentUrl("wss://claudjar.jarrin.nl")).toBe(
      "wss://claudjar.jarrin.nl/ws/agent",
    );
    expect(agentUrl("ws://localhost:3000/custom")).toBe(
      "ws://localhost:3000/custom",
    );
  });
});

describe("connectMonitor", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("queues while connecting, then sends hello, status and lines", () => {
    const sockets: FakeSocket[] = [];
    const monitor = connectMonitor({
      url: "ws://x",
      token: "tok",
      instance,
      now: () => 5,
      open: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s;
      },
    });
    monitor.status("running");
    monitor.loop("=== #1 start");
    vi.advanceTimersByTime(500);
    const s = sockets[0];
    if (!s) throw new Error("no socket");
    expect(s.sent).toEqual([]);
    s.accept();
    expect(s.sent).toEqual([
      { type: "hello", instance, token: "tok" },
      { type: "status", status: "running", paused: false },
      { type: "log", lines: [{ t: 5, kind: "loop", text: "=== #1 start" }] },
    ]);
  });

  it("reconnects with the same instance after a drop and flushes the backlog", () => {
    const sockets: FakeSocket[] = [];
    const monitor = connectMonitor({
      url: "ws://x",
      token: "",
      instance,
      now: () => 0,
      open: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s;
      },
    });
    sockets[0]?.accept();
    sockets[0]?.drop();
    monitor.loop("while down");
    vi.advanceTimersByTime(3000);
    const second = sockets[1];
    if (!second) throw new Error("no reconnect");
    second.accept();
    expect(second.sent[0]).toEqual({ type: "hello", instance });
    expect(second.sent[2]).toMatchObject({
      type: "log",
      lines: [{ text: "while down" }],
    });
  });

  it("stops reconnecting once closed", async () => {
    const sockets: FakeSocket[] = [];
    const monitor = connectMonitor({
      url: "ws://x",
      token: "",
      instance,
      open: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s;
      },
    });
    sockets[0]?.accept();
    await monitor.close();
    vi.advanceTimersByTime(10_000);
    expect(sockets).toHaveLength(1);
  });
});

describe("connectMonitor as the loop store", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  const M = { id: 4, title: "M" };
  const entry = {
    number: 1,
    title: "a",
    status: "working" as const,
    steps: [],
    sessionId: null,
    questionId: null,
    stashed: false,
  };

  function connected(onInput?: (text: string) => void) {
    const sockets: FakeSocket[] = [];
    let ids = 0;
    const monitor = connectMonitor({
      url: "ws://x",
      token: "",
      instance,
      now: () => 0,
      newId: () => `q${String(++ids)}`,
      onInput,
      open: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s;
      },
    });
    const socket = (n: number): FakeSocket => {
      const s = sockets[n];
      if (!s) throw new Error(`no socket ${String(n)}`);
      return s;
    };
    socket(0).accept();
    return { monitor, socket };
  }

  it("is ready once welcomed, with the stored boards and questions", async () => {
    const { monitor, socket } = connected();
    socket(0).receive({
      type: "welcome",
      boards: [{ repo: "o/r", milestone: M, entries: [entry], updatedAt: 0 }],
      questions: [
        {
          id: "old",
          repo: "o/r",
          milestone: M,
          issue: 1,
          title: "a",
          text: "?",
          askedAt: 0,
          answer: "yes",
          answeredAt: 1,
        },
      ],
    });
    await monitor.ready;
    expect(monitor.stored(M)).toEqual([entry]);
    expect(monitor.stored({ id: 9, title: "x" })).toEqual([]);
    expect(monitor.question("old")).toEqual({ answer: "yes" });
    expect(monitor.question("nope")).toBeNull();
  });

  it("sends the latest board per milestone, coalesced", () => {
    const { monitor, socket } = connected();
    monitor.save(M, [entry]);
    monitor.save(M, [{ ...entry, status: "closed" }]);
    vi.advanceTimersByTime(200);
    const progress = socket(0).sent.filter((m) => m.type === "progress");
    expect(progress).toEqual([
      {
        type: "progress",
        milestone: M,
        entries: [{ ...entry, status: "closed" }],
      },
    ]);
  });

  it("asks, takes the answer, wakes a wait, and resolves", async () => {
    const { monitor, socket } = connected();
    const id = monitor.ask(M, { number: 1, title: "a" }, "A or B?");
    expect(socket(0).sent.at(-1)).toEqual({
      type: "ask",
      question: { id, milestone: M, issue: 1, title: "a", text: "A or B?" },
    });
    expect(monitor.question(id)).toEqual({ answer: null });
    const waited = monitor.wait(60_000);
    socket(0).receive({ type: "answer", questionId: id, text: "B" });
    await waited;
    expect(monitor.question(id)).toEqual({ answer: "B" });
    monitor.resolve(id);
    expect(socket(0).sent.at(-1)).toEqual({ type: "resolved", questionId: id });
  });

  it("re-sends unresolved asks and pending resolves on reconnect", () => {
    const { monitor, socket } = connected();
    socket(0).drop();
    const kept = monitor.ask(M, { number: 1, title: "a" }, "?");
    const gone = monitor.ask(M, { number: 2, title: "b" }, "?");
    monitor.resolve(gone);
    vi.advanceTimersByTime(3000);
    socket(1).accept();
    expect(socket(1).sent[1]).toEqual({ type: "resolved", questionId: gone });
    expect(socket(1).sent[2]).toMatchObject({
      type: "ask",
      question: { id: kept },
    });
  });

  it("pauses and resumes on control, reporting it with the status", () => {
    const { monitor, socket } = connected();
    socket(0).receive({ type: "control", action: "pause" });
    expect(monitor.paused()).toBe(true);
    vi.advanceTimersByTime(200);
    expect(socket(0).sent).toContainEqual({
      type: "status",
      status: "starting",
      paused: true,
    });
    socket(0).receive({ type: "control", action: "resume" });
    expect(monitor.paused()).toBe(false);
  });

  it("hands input to the loop and logs it", () => {
    const got: string[] = [];
    const { socket } = connected((t) => got.push(t));
    socket(0).receive({ type: "input", text: "use v2" });
    vi.advanceTimersByTime(200);
    expect(got).toEqual(["use v2"]);
    expect(socket(0).sent.at(-1)).toMatchObject({
      type: "log",
      lines: [{ kind: "input", text: "✉ use v2" }],
    });
  });
});

describe("streamLines", () => {
  const feed = (msg: unknown) => streamLines(JSON.stringify(msg), 7, 1);

  it("renders assistant text, thinking and tool calls", () => {
    const lines = feed({
      type: "assistant",
      message: {
        content: [
          { type: "thinking", thinking: "hmm" },
          { type: "text", text: "Doing it.\n" },
          { type: "tool_use", name: "Bash", input: { command: "git status" } },
          { type: "tool_use", name: "Read", input: { file_path: "/a.ts" } },
        ],
      },
    });
    expect(lines.map((l) => [l.kind, l.text, l.issue])).toEqual([
      ["thinking", "hmm", 7],
      ["text", "Doing it.", 7],
      ["tool", "→ Bash  git status", 7],
      ["tool", "→ Read  /a.ts", 7],
    ]);
  });

  it("truncates long tool output and colours errors", () => {
    const long = Array.from({ length: 20 }, (_, i) => `l${String(i)}`).join(
      "\n",
    );
    const [ok] = feed({
      type: "user",
      message: { content: [{ type: "tool_result", content: long }] },
    });
    expect(ok?.kind).toBe("output");
    expect(ok?.text.split("\n")).toHaveLength(13);
    expect(ok?.text).toMatch(/… 8 more lines$/);
    const [bad] = feed({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            is_error: true,
            content: [{ type: "text", text: "boom" }],
          },
        ],
      },
    });
    expect(bad).toMatchObject({ kind: "error", text: "boom" });
  });

  it("keeps JSON tool output parseable instead of cutting its tail", () => {
    const comments = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      body: `**Stage ${String(i)}**\n${"x".repeat(5000)}`,
    }));
    const [out] = feed({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            content: [{ type: "text", text: JSON.stringify(comments) }],
          },
        ],
      },
    });
    const text = out?.text ?? "";
    expect(text.length).toBeLessThanOrEqual(12_000);
    const parsed = JSON.parse(text) as unknown[];
    expect(parsed).toHaveLength(51);
    expect(parsed[0]).toMatchObject({ id: 0 });
    expect(parsed[50]).toBe("… 10 more items");
  });

  it("summarises the result and session init", () => {
    expect(
      feed({
        type: "result",
        is_error: false,
        num_turns: 3,
        duration_ms: 61_400,
        total_cost_usd: 0.4567,
      })[0],
    ).toMatchObject({
      kind: "result",
      text: "session done · 3 turns · 61s · $0.46",
    });
    expect(
      feed({
        type: "system",
        subtype: "init",
        session_id: "abcdef123",
        model: "m",
      })[0]?.text,
    ).toBe("session abcdef12 started · m");
  });

  it("flags a rejected rate limit and ignores the rest", () => {
    expect(
      feed({
        type: "rate_limit_event",
        rate_limit_info: { status: "rejected" },
      }),
    ).toMatchObject([{ kind: "error" }]);
    expect(
      feed({
        type: "rate_limit_event",
        rate_limit_info: { status: "allowed" },
      }),
    ).toEqual([]);
    expect(streamLines("not json", 1, 0)).toMatchObject([{ kind: "system" }]);
  });
});
