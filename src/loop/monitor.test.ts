import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentMessage } from "../../monitor/shared/protocol.js";
import { agentUrl, connectMonitor, streamLines } from "./monitor.js";
import type { SocketLike } from "./monitor.js";

class FakeSocket implements SocketLike {
  readyState = 0;
  bufferedAmount = 0;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
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
  drop(): void {
    this.readyState = 3;
    this.onclose?.(new Event("close") as CloseEvent);
  }
}

const instance = {
  id: "i1",
  host: "desktop",
  repo: "o/r",
  milestones: ["M"],
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
      { type: "status", status: "running" },
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
    expect(second.sent[1]).toMatchObject({
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
