import { describe, expect, it } from "vitest";

import {
  parseAgentMessage,
  parseHostMessage,
  parseWatcherMessage,
} from "./schema";

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

  it("keeps a line's call id and tool detail", () => {
    const detail = {
      type: "patch",
      file: "/f",
      hunks: [{ oldStart: 1, newStart: 1, lines: ["-a", "+b"] }],
      omitted: 0,
    };
    const msg = parseAgentMessage(
      JSON.stringify({
        type: "log",
        lines: [{ t: 0, kind: "output", text: "ok", call: "tu_1", detail }],
      }),
    );
    if (msg?.type !== "log") throw new Error("not a log");
    expect(msg.lines[0]).toMatchObject({ call: "tu_1", detail });
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
      parseWatcherMessage('{"type":"control","id":"a","action":"stop"}'),
    ).toEqual({ type: "control", id: "a", action: "stop" });
    expect(
      parseWatcherMessage('{"type":"control","id":"a","action":"kill"}'),
    ).toBeNull();
    expect(
      parseWatcherMessage('{"type":"input","id":"a","text":""}'),
    ).toBeNull();
  });
});

const project = {
  name: "x",
  path: "/p/x",
  configured: true,
  backlogRepo: "o/x",
  active: false,
};

describe("parseHostMessage", () => {
  it("accepts a host-hello with its projects", () => {
    const msg = parseHostMessage(
      JSON.stringify({
        type: "host-hello",
        host: { host: "desk", pid: 1, startedAt: 2 },
        token: "t",
        projects: [project],
      }),
    );
    expect(msg).toMatchObject({ type: "host-hello", projects: [project] });
  });

  it("accepts projects, project-state and command-result", () => {
    for (const m of [
      { type: "projects", projects: [project] },
      { type: "project-state", project: { ...project, active: true } },
      { type: "command-result", result: { id: "c", ok: false, error: "no" } },
    ])
      expect(parseHostMessage(JSON.stringify(m))?.type).toBe(m.type);
  });

  it("accepts a project-detail and rejects an unknown session status", () => {
    const worktree = {
      name: "dev",
      branch: "dev",
      path: "/p/x-worktrees/dev",
      port: 8001,
      milestone: "plan-x",
      session: "running",
    };
    const detail = {
      project: "x",
      repo: "o/x",
      forge: "https://g",
      milestones: [{ id: 1, title: "plan-x", openIssues: 1, closedIssues: 2 }],
      worktrees: [worktree],
      error: "",
      collectedAt: 3,
    };
    // A host older than `loopPid` sends none: it reads as no pinned loop.
    expect(
      parseHostMessage(JSON.stringify({ type: "project-detail", detail })),
    ).toEqual({
      type: "project-detail",
      detail: { ...detail, worktrees: [{ ...worktree, loopPid: 0 }] },
    });
    expect(
      parseHostMessage(
        JSON.stringify({
          type: "project-detail",
          detail: {
            ...detail,
            worktrees: [{ ...worktree, session: "zombie" }],
          },
        }),
      ),
    ).toBeNull();
  });

  it("rejects a host without a name and a project missing a field", () => {
    expect(
      parseHostMessage(
        JSON.stringify({
          type: "host-hello",
          host: { host: "", pid: 1, startedAt: 2 },
          projects: [],
        }),
      ),
    ).toBeNull();
    const { active: _active, ...partial } = project;
    expect(
      parseHostMessage(
        JSON.stringify({ type: "projects", projects: [partial] }),
      ),
    ).toBeNull();
  });

  it("rejects agent messages on the host channel", () => {
    expect(
      parseHostMessage(
        JSON.stringify({ type: "status", status: "x", paused: false }),
      ),
    ).toBeNull();
  });
});

describe("parseWatcherMessage command", () => {
  it("accepts open-project, close-project and refresh-project", () => {
    for (const type of ["open-project", "close-project", "refresh-project"])
      expect(
        parseWatcherMessage(
          JSON.stringify({
            type: "command",
            id: "c1",
            host: "desk",
            command: { type, project: "x" },
          }),
        ),
      ).toMatchObject({ type: "command", command: { type } });
  });

  it("accepts create-worktree, and rejects a bad mode or milestone", () => {
    const send = (command: unknown): unknown =>
      parseWatcherMessage(
        JSON.stringify({ type: "command", id: "c1", host: "desk", command }),
      );
    const loop = {
      type: "create-worktree",
      project: "x",
      milestone: { id: 7, title: "plan-x" },
      mode: "loop",
    };
    expect(send(loop)).toMatchObject({ command: loop });
    const session = {
      type: "create-worktree",
      project: "x",
      name: "dev",
      mode: "session",
    };
    expect(send(session)).toMatchObject({ command: session });
    expect(send({ ...loop, mode: "daemon" })).toBeNull();
    expect(send({ ...loop, milestone: { title: "plan-x" } })).toBeNull();
    expect(send({ ...session, name: "x".repeat(200) })).toBeNull();
  });

  it("accepts the worktree commands, and rejects a missing worktree or remove flag", () => {
    const send = (command: unknown): unknown =>
      parseWatcherMessage(
        JSON.stringify({ type: "command", id: "c1", host: "desk", command }),
      );
    for (const type of ["stop-loop", "resume-loop", "remove-worktree"]) {
      const cmd = { type, project: "x", worktree: "dev" };
      expect(send(cmd)).toMatchObject({ command: cmd });
      expect(send({ type, project: "x" })).toBeNull();
      expect(send({ type, project: "x", worktree: "" })).toBeNull();
    }
    const merge = {
      type: "merge-worktree",
      project: "x",
      worktree: "dev",
      remove: true,
    };
    expect(send(merge)).toMatchObject({ command: merge });
    expect(send({ ...merge, remove: undefined })).toBeNull();
  });

  it("rejects an unknown command and a missing id", () => {
    expect(
      parseWatcherMessage(
        JSON.stringify({
          type: "command",
          id: "c1",
          host: "desk",
          command: { type: "rm-rf", project: "x" },
        }),
      ),
    ).toBeNull();
    expect(
      parseWatcherMessage(
        JSON.stringify({
          type: "command",
          host: "desk",
          command: { type: "open-project", project: "x" },
        }),
      ),
    ).toBeNull();
  });
});
