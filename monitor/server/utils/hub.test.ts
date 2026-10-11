import { describe, expect, it } from "vitest";

import type {
  Entry,
  InstanceInfo,
  ServerHostMessage,
  ServerMessage,
  WatchMessage,
} from "#shared/protocol";

import {
  COMMAND_TIMEOUT_MS,
  Hub,
  MAX_LINES,
  MAX_LIVE,
  OFFLINE_TTL_MS,
} from "./hub";
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

  describe("live logs", () => {
    const post = (chunk: string, done = false, id = "toolu_1") => ({
      id,
      file: "/tmp/check.log",
      command: "task check > /tmp/check.log",
      source: {
        kind: "session" as const,
        host: "h",
        where: "/r",
        session: "s",
      },
      startedAt: 5,
      chunk,
      done,
    });

    it("accumulates posted chunks, broadcasts them, and ignores late ones", () => {
      const hub = new Hub(() => 9);
      const got = watched(hub);
      hub.livePost({ ...post("a\n"), token: "secret" });
      hub.livePost(post("b\n", true));
      hub.livePost(post("late\n"));
      expect(got.filter((m) => m.type === "live")).toHaveLength(2);
      expect(JSON.stringify(got)).not.toContain("secret");
      const [snap] = watched(hub);
      expect(snap).toMatchObject({
        type: "snapshot",
        live: [{ id: "toolu_1", text: "a\nb\n", done: true, updatedAt: 9 }],
      });
    });

    it("mirrors a loop's tail lines, with the command of their call", () => {
      const hub = new Hub(() => 1);
      hub.hello(info(), () => {});
      hub.log("a", [
        {
          t: 1,
          kind: "tool",
          text: "Bash",
          call: "c1",
          detail: { type: "command", command: "make > out.log" },
        },
        {
          t: 2,
          kind: "tail",
          text: "built\n",
          call: "c1",
          detail: { type: "tail", file: "/r/out.log", done: true },
        },
      ]);
      const [snap] = watched(hub);
      expect(snap).toMatchObject({
        live: [
          {
            id: "c1",
            file: "/r/out.log",
            command: "make > out.log",
            source: { kind: "loop", where: "jarrin/x", session: "a" },
            text: "built\n",
            done: true,
          },
        ],
      });
    });

    it("drops the least recently active log beyond the cap", () => {
      const hub = new Hub(() => 1);
      const got = watched(hub);
      for (let i = 0; i <= MAX_LIVE; i++)
        hub.livePost(post("x", false, `c${String(i)}`));
      expect(got).toContainEqual({ type: "live-removed", id: "c0" });
    });
    it("dismisses finished logs only", () => {
      const hub = new Hub(() => 1);
      const got = watched(hub);
      hub.livePost(post("a", false, "run"));
      hub.livePost(post("b", true, "fin"));
      hub.dismissLive("run");
      hub.dismissLive("fin");
      expect(got.filter((m) => m.type === "live-removed")).toEqual([
        { type: "live-removed", id: "fin" },
      ]);
    });
  });

  it("closes a question once its issue shows closed, also on restore", () => {
    const entry = (status: Entry["status"]): Entry => ({
      number: 3,
      title: "t",
      status,
      steps: [],
      sessionId: null,
      questionId: "q1",
      stashed: false,
    });
    const hub = new Hub(() => 1);
    hub.hello(info(), () => {});
    hub.ask("a", { id: "q1", milestone: M1, issue: 3, title: "t", text: "?" });
    const got = watched(hub);
    hub.progress("a", M1, [entry("closed")]);
    expect(got).toContainEqual({ type: "question-closed", id: "q1" });

    const restored = new Hub(() => 1);
    restored.restore({
      instances: [],
      hosts: [],
      details: [],
      boards: [
        {
          repo: "jarrin/x",
          milestone: M1,
          entries: [entry("closed")],
          updatedAt: 0,
        },
      ],
      questions: [
        {
          id: "q1",
          repo: "jarrin/x",
          milestone: M1,
          issue: 3,
          title: "t",
          text: "?",
          askedAt: 0,
          answer: null,
          answeredAt: null,
        },
      ],
    });
    expect(watched(restored)[0]).toMatchObject({ questions: [] });
  });
});

describe("Hub hosts", () => {
  const proj = (name: string, active = false) => ({
    name,
    path: `/p/${name}`,
    configured: true,
    backlogRepo: "",
    active,
  });
  const hostInfo = (host: string) => ({ host, pid: 1, startedAt: 0 });

  it("welcomes a host and shows it with its projects to watchers", () => {
    const hub = new Hub(() => 5);
    const got = watched(hub);
    const toHost: ServerHostMessage[] = [];
    hub.hostHello(hostInfo("desk"), [proj("a")], (m) => toHost.push(m));
    expect(toHost).toEqual([{ type: "host-welcome" }]);
    expect(got.at(-1)).toEqual({
      type: "host",
      host: {
        ...hostInfo("desk"),
        online: true,
        lastSeen: 5,
        projects: [proj("a")],
      },
    });
    expect(watched(hub)[0]).toMatchObject({
      type: "snapshot",
      hosts: [{ host: "desk", projects: [proj("a")] }],
    });
  });

  it("replaces the project list and upserts single projects", () => {
    const hub = new Hub(() => 1);
    hub.hostHello(hostInfo("desk"), [proj("a")], () => {});
    hub.hostProjects("desk", [proj("a"), proj("b")]);
    hub.hostProject("desk", proj("b", true));
    hub.hostProject("desk", proj("c"));
    expect(watched(hub)[0]).toMatchObject({
      hosts: [{ projects: [proj("a"), proj("b", true), proj("c")] }],
    });
  });

  it("relays a forge event only to online hosts with that backlog repo", () => {
    const hub = new Hub(() => 1);
    const desk: ServerHostMessage[] = [];
    const laptop: ServerHostMessage[] = [];
    const away: ServerHostMessage[] = [];
    const withRepo = { ...proj("a"), backlogRepo: "Jarrin/Repo" };
    hub.hostHello(hostInfo("desk"), [withRepo], (m) => desk.push(m));
    hub.hostHello(hostInfo("laptop"), [proj("b")], (m) => laptop.push(m));
    hub.hostHello(hostInfo("away"), [withRepo], (m) => away.push(m));
    hub.hostDisconnect("away");
    const event = { repo: "jarrin/repo", event: "issues", action: "opened" };
    expect(hub.forgeEvent(event)).toBe(1);
    expect(desk.at(-1)).toEqual({ type: "forge-event", event });
    expect(laptop).toEqual([{ type: "host-welcome" }]);
    expect(away).toEqual([{ type: "host-welcome" }]);
  });

  it("routes a command to the named host only, and its result to every watcher", () => {
    const hub = new Hub(() => 1);
    const desk: ServerHostMessage[] = [];
    const laptop: ServerHostMessage[] = [];
    hub.hostHello(hostInfo("desk"), [], (m) => desk.push(m));
    hub.hostHello(hostInfo("laptop"), [], (m) => laptop.push(m));
    const a = watched(hub);
    const b = watched(hub);
    const command = { type: "open-project" as const, project: "x" };
    hub.command("c1", "laptop", command);
    expect(laptop.at(-1)).toEqual({ type: "command", id: "c1", command });
    expect(desk).toEqual([{ type: "host-welcome" }]);

    // Only the host it was sent to may answer it.
    hub.hostResult("desk", { id: "c1", ok: true, error: "" });
    expect(a.some((m) => m.type === "command-result")).toBe(false);

    hub.hostResult("laptop", { id: "c1", ok: true, error: "" });
    const outcome = {
      type: "command-result",
      result: { id: "c1", ok: true, error: "", host: "laptop", command, at: 1 },
    };
    expect(a.at(-1)).toEqual(outcome);
    expect(b.at(-1)).toEqual(outcome);
    // A duplicate answer changes nothing.
    hub.hostResult("laptop", { id: "c1", ok: false, error: "late" });
    expect(a.filter((m) => m.type === "command-result")).toHaveLength(1);
  });

  it("fails a command to an offline or unknown host at once", () => {
    const hub = new Hub(() => 1);
    hub.hostHello(hostInfo("desk"), [], () => {});
    hub.hostDisconnect("desk");
    const got = watched(hub);
    hub.command("c1", "desk", { type: "close-project", project: "x" });
    hub.command("c2", "nope", { type: "close-project", project: "x" });
    expect(
      got.flatMap((m) => (m.type === "command-result" ? [m.result] : [])),
    ).toMatchObject([
      { id: "c1", ok: false, error: "host is offline" },
      { id: "c2", ok: false, error: "host is offline" },
    ]);
  });

  it("fails pending commands when their host disconnects", () => {
    const hub = new Hub(() => 1);
    hub.hostHello(hostInfo("desk"), [], () => {});
    const got = watched(hub);
    hub.command("c1", "desk", { type: "open-project", project: "x" });
    hub.hostDisconnect("desk");
    expect(got).toContainEqual(
      expect.objectContaining({
        type: "command-result",
        result: expect.objectContaining({
          id: "c1",
          error: "host disconnected",
        }),
      }),
    );
    expect(got.at(-1)).toMatchObject({ type: "host", host: { online: false } });
  });

  it("expires a command the host never answered", () => {
    let t = 0;
    const hub = new Hub(() => t);
    hub.hostHello(hostInfo("desk"), [], () => {});
    const got = watched(hub);
    hub.command("c1", "desk", { type: "open-project", project: "x" });
    t = COMMAND_TIMEOUT_MS + 1;
    hub.command("c2", "desk", { type: "open-project", project: "y" });
    expect(got).toContainEqual(
      expect.objectContaining({
        result: expect.objectContaining({
          id: "c1",
          error: "host did not answer",
        }),
      }),
    );
  });

  it("gives create-worktree longer before expiring it", () => {
    let t = 0;
    const hub = new Hub(() => t);
    hub.hostHello(hostInfo("desk"), [], () => {});
    const got = watched(hub);
    hub.command("c1", "desk", {
      type: "create-worktree",
      project: "x",
      name: "dev",
      mode: "session",
    });
    t = COMMAND_TIMEOUT_MS + 1;
    hub.command("c2", "desk", { type: "open-project", project: "y" });
    const expired = (id: string): boolean =>
      got.some(
        (m) =>
          m.type === "command-result" &&
          m.result.id === id &&
          m.result.error === "host did not answer",
      );
    expect(expired("c1")).toBe(false);
    t = 15 * 60 * 1000 + 1;
    hub.command("c3", "desk", { type: "open-project", project: "z" });
    expect(expired("c1")).toBe(true);
  });

  it("persists hosts and restores them offline with their projects", () => {
    let saved: Saved | null = null;
    const hub = new Hub(
      () => 1,
      (s) => (saved = s),
    );
    hub.hostHello(hostInfo("desk"), [proj("a", true)], () => {});
    expect(saved).toMatchObject({ hosts: [{ host: "desk", online: true }] });
    const restored = new Hub(() => 2);
    if (!saved) throw new Error("not saved");
    restored.restore(saved);
    expect(watched(restored)[0]).toMatchObject({
      hosts: [{ host: "desk", online: false, projects: [proj("a", true)] }],
    });
  });

  const detail = (project: string) => ({
    project,
    repo: "o/r",
    forge: "https://g",
    milestones: [{ id: 1, title: "plan-x", openIssues: 2, closedIssues: 3 }],
    worktrees: [
      {
        name: "",
        branch: "main",
        path: `/p/${project}`,
        port: 0,
        milestone: "",
        session: "running" as const,
        loopPid: 0,
      },
    ],
    error: "",
    collectedAt: 7,
  });

  it("stores an active project's detail and shows it to watchers", () => {
    const hub = new Hub(() => 1);
    hub.hostHello(hostInfo("desk"), [proj("a", true), proj("b")], () => {});
    const got = watched(hub);
    hub.hostDetail("desk", detail("a"));
    expect(got.at(-1)).toEqual({
      type: "project-detail",
      detail: { ...detail("a"), host: "desk" },
    });
    // An inactive or unknown project has no tab to fill.
    hub.hostDetail("desk", detail("b"));
    hub.hostDetail("desk", detail("zz"));
    hub.hostDetail("ghost", detail("a"));
    expect(watched(hub)[0]).toMatchObject({
      details: [{ host: "desk", project: "a" }],
    });
    // A refresh replaces it.
    hub.hostDetail("desk", { ...detail("a"), collectedAt: 9 });
    expect(watched(hub)[0]).toMatchObject({
      details: [{ project: "a", collectedAt: 9 }],
    });
  });

  it("drops a project's detail when it is closed or disappears", () => {
    const hub = new Hub(() => 1);
    hub.hostHello(
      hostInfo("desk"),
      [proj("a", true), proj("b", true)],
      () => {},
    );
    hub.hostDetail("desk", detail("a"));
    hub.hostDetail("desk", detail("b"));
    const got = watched(hub);
    hub.hostProject("desk", proj("a"));
    expect(got).toContainEqual({
      type: "project-detail-removed",
      host: "desk",
      project: "a",
    });
    hub.hostProjects("desk", []);
    expect(got).toContainEqual({
      type: "project-detail-removed",
      host: "desk",
      project: "b",
    });
    expect(watched(hub)[0]).toMatchObject({ details: [] });
  });

  it("keeps a detail across a disconnect and a restart", () => {
    let saved: Saved | null = null;
    const hub = new Hub(
      () => 1,
      (s) => (saved = s),
    );
    hub.hostHello(hostInfo("desk"), [proj("a", true)], () => {});
    hub.hostDetail("desk", detail("a"));
    hub.hostDisconnect("desk");
    expect(watched(hub)[0]).toMatchObject({ details: [{ project: "a" }] });
    if (!saved) throw new Error("not saved");
    const restored = new Hub(() => 2);
    restored.restore(saved);
    expect(watched(restored)[0]).toMatchObject({
      details: [{ host: "desk", project: "a" }],
    });
  });

  it("ignores project updates from a host that is not connected", () => {
    const hub = new Hub(() => 1);
    hub.hostProjects("ghost", [proj("a")]);
    expect(watched(hub)[0]).toMatchObject({ hosts: [] });
  });
});
