import { describe, expect, it } from "vitest";

import { parseAgentMessage, parseWatcherMessage } from "./schema";

describe("parseAgentMessage", () => {
  it("accepts a hello", () => {
    const msg = parseAgentMessage(
      JSON.stringify({
        type: "hello",
        instance: {
          id: "a",
          host: "h",
          repo: "o/r",
          milestones: [{ id: 1, title: "M" }],
          pid: 1,
          startedAt: 2,
        },
      }),
    );
    expect(msg?.type).toBe("hello");
  });

  it("truncates oversized log text", () => {
    const msg = parseAgentMessage(
      JSON.stringify({
        type: "log",
        lines: [{ t: 0, kind: "output", text: "x".repeat(100_000) }],
      }),
    );
    if (msg?.type !== "log") throw new Error("not a log");
    expect(msg.lines[0]?.text.length).toBe(64 * 1024);
  });

  it("rejects junk and unknown kinds", () => {
    expect(parseAgentMessage("not json")).toBeNull();
    expect(
      parseAgentMessage(
        JSON.stringify({ type: "log", lines: [{ t: 0, kind: "x", text: "" }] }),
      ),
    ).toBeNull();
    expect(parseAgentMessage(JSON.stringify({ type: "nope" }))).toBeNull();
  });
});

describe("parseWatcherMessage", () => {
  it("accepts a dismiss", () => {
    expect(parseWatcherMessage('{"type":"dismiss","id":"a"}')).toEqual({
      type: "dismiss",
      id: "a",
    });
  });

  it("accepts an answer, a control and an input", () => {
    expect(
      parseWatcherMessage('{"type":"answer","questionId":"q","text":"yes"}'),
    ).toMatchObject({ type: "answer" });
    expect(
      parseWatcherMessage('{"type":"control","id":"a","action":"pause"}'),
    ).toMatchObject({ action: "pause" });
    expect(
      parseWatcherMessage('{"type":"control","id":"a","action":"kill"}'),
    ).toBeNull();
    expect(
      parseWatcherMessage('{"type":"input","id":"a","text":""}'),
    ).toBeNull();
  });
});
