import { describe, expect, it } from "vitest";

import type {
  Entry,
  InstanceInfo,
  ServerMessage,
  WatchMessage,
} from "#shared/protocol";

import { Hub, MAX_LINES, OFFLINE_TTL_MS } from "./hub";
import type { Saved } from "./hub";

const M1 = { id: 7, title: "M1" };

const info = (id = "a"): InstanceInfo => ({
  id,
  host: "desktop",
  repo: "jarrin/x",
  milestones: [M1],
  pid: 1,
  startedAt: 0,
});

const line = (text: string) => ({ t: 0, kind: "loop" as const, text });

function watched(hub: Hub): WatchMessage[] {
  const got: WatchMessage[] = [];
  hub.watch((m) => got.push(m));
  return got;
}

describe("Hub", () => {
  it("snapshots existing instances with their lines to a new watcher", () => {
    const hub = new Hub(() => 1);
    hub.hello(info(), () => {});
    hub.log("a", [line("one")]);
    const [snap] = watched(hub);
    expect(snap).toMatchObject({
      type: "snapshot",
      instances: [{ id: "a", online: true, lines: [{ text: "one" }] }],
    });
  });

  it("streams hello, log, status and disconnect to watchers", () => {
    const hub = new Hub(() => 1);
    const got = watched(hub);
    hub.hello(info(), () => {});
    hub.log("a", [line("x")]);
    hub.status("a", "finished", false);
    hub.disconnect("a");
    expect(got.map((m) => m.type)).toEqual([
      "snapshot",
      "instance",
      "log",
      "instance",
      "instance",
    ]);
    expect(got.at(-1)).toMatchObject({
      instance: { online: false, status: "finished" },
    });
  });

  it("keeps a reconnecting instance's lines", () => {
    const hub = new Hub(() => 1);
    hub.hello(info(), () => {});
    hub.log("a", [line("before")]);
    hub.disconnect("a");
    hub.hello(info(), () => {});
    const [snap] = watched(hub);
    expect(snap).toMatchObject({
      instances: [{ online: true, lines: [{ text: "before" }] }],
    });
  });

  it("caps the lines kept per instance", () => {
    const hub = new Hub(() => 1);
    hub.hello(info(), () => {});
    hub.log(
      "a",
      Array.from({ length: MAX_LINES + 10 }, (_, i) => line(`${i}`)),
    );
    const [snap] = watched(hub);
    if (snap?.type !== "snapshot") throw new Error("no snapshot");
    expect(snap.instances[0]?.lines).toHaveLength(MAX_LINES);
    expect(snap.instances[0]?.lines[0]?.text).toBe("10");
  });

  it("dismisses only offline instances", () => {
    const hub = new Hub(() => 1);
    hub.hello(info(), () => {});
    hub.dismiss("a");
    expect(watched(hub)[0]).toMatchObject({ instances: [{ id: "a" }] });
    hub.disconnect("a");
    hub.dismiss("a");
    expect(watched(hub)[0]).toMatchObject({ instances: [] });
  });

  it("forgets offline instances after the TTL", () => {
    let now = 0;
    const hub = new Hub(() => now);
    hub.hello(info(), () => {});
    hub.disconnect("a");
    now = OFFLINE_TTL_MS + 1;
    expect(watched(hub)[0]).toMatchObject({ instances: [] });
  });

  it("ignores logs for unknown instances", () => {
    const hub = new Hub(() => 1);
    const got = watched(hub);
    hub.log("nope", [line("x")]);
    expect(got).toHaveLength(1);
  });
});

const entry = (number: number, status: Entry["status"] = "open"): Entry => ({
  number,
  title: `issue ${String(number)}`,
  status,
  steps: [],
  sessionId: null,
  questionId: null,
  stashed: false,
});

const ask = (id = "q1") => ({
  id,
  milestone: M1,
  issue: 3,
  title: "issue 3",
  text: "which one?",
});

describe("Hub as the loop store", () => {
  it("welcomes an agent with the boards and questions of its milestones only", () => {
    const hub = new Hub(() => 1);
    hub.hello(info("old"), () => {});
    hub.progress("old", M1, [entry(3)]);
    hub.progress("old", { id: 99, title: "other" }, [entry(4)]);
    hub.ask("old", ask());
    const got: ServerMessage[] = [];
    hub.hello(info("new"), (m) => got.push(m));
    expect(got).toEqual([
      {
        type: "welcome",
        boards: [expect.objectContaining({ milestone: M1 })],
        questions: [expect.objectContaining({ id: "q1", answer: null })],
      },
    ]);
  });

  it("broadcasts boards and questions, and ignores a re-sent ask", () => {
    let now = 1;
    const hub = new Hub(() => now);
    hub.hello(info(), () => {});
    const got = watched(hub);
    hub.progress("a", M1, [entry(3, "working")]);
    hub.ask("a", ask());
    now = 2;
    hub.ask("a", { ...ask(), text: "again" });
    expect(got.slice(1)).toEqual([
      { type: "board", board: expect.objectContaining({ repo: "jarrin/x" }) },
      {
        type: "question",
        question: expect.objectContaining({ text: "which one?", askedAt: 1 }),
      },
    ]);
  });

  it("forwards an answer to the online agents on that milestone and closes on resolve", () => {
    const hub = new Hub(() => 5);
    const agent: ServerMessage[] = [];
    hub.hello(info(), (m) => agent.push(m));
    hub.ask("a", ask());
    const got = watched(hub);
    hub.answer("q1", "  the second  ");
    expect(agent.at(-1)).toEqual({
      type: "answer",
      questionId: "q1",
      text: "the second",
    });
    expect(got.at(-1)).toMatchObject({
      type: "question",
      question: { answer: "the second", answeredAt: 5 },
    });
    hub.resolved("q1");
    expect(got.at(-1)).toEqual({ type: "question-closed", id: "q1" });
  });

  it("relays pause, resume and input to the agent", () => {
    const hub = new Hub(() => 1);
    const agent: ServerMessage[] = [];
    hub.hello(info(), (m) => agent.push(m));
    hub.control("a", "pause");
    hub.input("a", " use the other API ");
    hub.input("a", "   ");
    expect(agent.slice(1)).toEqual([
      { type: "control", action: "pause" },
      { type: "input", text: "use the other API" },
    ]);
  });

  it("keeps an offline instance while it still has an open question", () => {
    let now = 0;
    const hub = new Hub(() => now);
    hub.hello(info(), () => {});
    hub.ask("a", ask());
    hub.disconnect("a");
    hub.dismiss("a");
    now = OFFLINE_TTL_MS + 1;
    expect(watched(hub)[0]).toMatchObject({ instances: [{ id: "a" }] });
  });

  it("persists durable changes and restores them offline", () => {
    let saved: Saved | null = null;
    const hub = new Hub(
      () => 1,
      (s) => (saved = s),
    );
    hub.hello(info(), () => {});
    hub.progress("a", M1, [entry(3)]);
    hub.ask("a", ask());
    hub.log("a", [line("not durable")]);
    if (!saved) throw new Error("nothing saved");
    const restored = new Hub(() => 2);
    restored.restore(saved);
    expect(watched(restored)[0]).toMatchObject({
      instances: [{ id: "a", online: false, lines: [] }],
      boards: [{ milestone: M1 }],
      questions: [{ id: "q1" }],
    });
  });
});
