import { describe, expect, it } from "vitest";

import {
  createLauncher,
  parseAgents,
  parseBackgrounded,
  parseTmuxSessions,
  SCOPE_PREFIX,
  type ProcResult,
  type ProcRunner,
} from "./launcher.js";

interface Call {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly cwd: string | undefined;
}

/** A runner that records every call and answers from `reply`. */
function fakeRunner(reply: (argv: string[]) => Partial<ProcResult>): {
  run: ProcRunner;
  calls: Call[];
} {
  const calls: Call[] = [];
  const run: ProcRunner = (cmd, args, cwd) => {
    calls.push({ cmd, args, cwd });
    return { status: 0, stdout: "", stderr: "", ...reply([cmd, ...args]) };
  };
  return { run, calls };
}

const AGENTS = JSON.stringify([
  {
    pid: 11,
    cwd: "/p/a",
    kind: "interactive",
    sessionId: "aaaaaaaa-0000",
    name: "a-1",
    status: "busy",
  },
  {
    pid: 22,
    id: "c9a41849",
    cwd: "/p/b",
    kind: "background",
    sessionId: "c9a41849-4739",
    name: "web",
    status: "idle",
    state: "working",
  },
  {
    id: "1bcf52d6",
    cwd: "/p/c",
    kind: "background",
    sessionId: "1bcf52d6-4170",
    name: "docs",
    state: "done",
  },
]);

describe("parseAgents", () => {
  it("keeps background sessions only and reads liveness from pid", () => {
    expect(parseAgents(AGENTS)).toEqual([
      {
        name: "web",
        id: "c9a41849",
        cwd: "/p/b",
        running: true,
        state: "working",
      },
      {
        name: "docs",
        id: "1bcf52d6",
        cwd: "/p/c",
        running: false,
        state: "done",
      },
    ]);
  });

  it("falls back to the short session id and skips malformed entries", () => {
    const json = JSON.stringify([
      { kind: "background", sessionId: "deadbeef-1234", cwd: "/x" },
      { kind: "background", cwd: "/no-session-id" },
      "garbage",
    ]);
    expect(parseAgents(json)).toEqual([
      { name: "", id: "deadbeef", cwd: "/x", running: false, state: "unknown" },
    ]);
  });

  it("rejects a non-array payload", () => {
    expect(() => parseAgents("{}")).toThrow(/expected an array/);
  });
});

describe("parseBackgrounded", () => {
  it("reads the id from claude --bg output", () => {
    const out =
      "backgrounded · a01b2d00 · web (idle — send a prompt to start)\n  claude agents  list sessions\n";
    expect(parseBackgrounded(out)).toBe("a01b2d00");
    expect(parseBackgrounded("Workspace not trusted.")).toBeNull();
  });
});

describe("parseTmuxSessions", () => {
  it("parses name, cwd and attachment", () => {
    expect(parseTmuxSessions("web\t/p/b\t0\ndocs\t/p/c\t1\n\n")).toEqual([
      { name: "web", id: "web", cwd: "/p/b", running: true, state: "detached" },
      {
        name: "docs",
        id: "docs",
        cwd: "/p/c",
        running: true,
        state: "attached",
      },
    ]);
  });
});

describe("bg launcher", () => {
  const replyAgents = (argv: string[]): Partial<ProcResult> => {
    if (argv.includes("agents")) return { stdout: AGENTS };
    if (argv.includes("--bg")) {
      return { stdout: "backgrounded · 0123abcd · new\n" };
    }
    return {};
  };

  it("starts a scoped remote-control, permission-free session", () => {
    const { run, calls } = fakeRunner(replyAgents);
    const launcher = createLauncher({ run, scope: true });
    const s = launcher.start("new", "/p/new");
    expect(s).toEqual({
      name: "new",
      id: "0123abcd",
      cwd: "/p/new",
      running: true,
      state: "idle",
    });
    const last = calls.at(-1);
    expect(last?.cwd).toBe("/p/new");
    expect([last?.cmd, ...(last?.args ?? [])]).toEqual([
      ...SCOPE_PREFIX,
      "claude",
      "--bg",
      "--remote-control",
      "new",
      "--dangerously-skip-permissions",
      "--name",
      "new",
    ]);
  });

  it("scopes the agents listing too, since it can spawn the daemon", () => {
    const { run, calls } = fakeRunner(replyAgents);
    createLauncher({ run, scope: true }).list();
    expect([calls[0]?.cmd, ...(calls[0]?.args ?? [])]).toEqual([
      ...SCOPE_PREFIX,
      "claude",
      "agents",
      "--json",
    ]);
  });

  it("runs unscoped when scope is off", () => {
    const { run, calls } = fakeRunner(replyAgents);
    createLauncher({ run, scope: false, claudeBin: "/bin/claude" }).list();
    expect(calls[0]?.cmd).toBe("/bin/claude");
  });

  it("detects scope support once, lazily", () => {
    const { run, calls } = fakeRunner((argv) =>
      argv.includes("true") ? { status: 1 } : replyAgents(argv),
    );
    const launcher = createLauncher({ run });
    launcher.list();
    launcher.list();
    expect(calls.filter((c) => c.args.includes("true"))).toHaveLength(1);
    expect(calls.at(-1)?.cmd).toBe("claude");
  });

  it("refuses to start a name that is already running", () => {
    const { run } = fakeRunner(replyAgents);
    expect(() =>
      createLauncher({ run, scope: false }).start("web", "/p"),
    ).toThrow(/already running/);
  });

  it("surfaces claude's own error when the start fails", () => {
    const { run } = fakeRunner((argv) =>
      argv.includes("--bg")
        ? { status: 1, stderr: "Workspace not trusted. Run `claude` once.\n" }
        : replyAgents(argv),
    );
    expect(() =>
      createLauncher({ run, scope: false }).start("x", "/p"),
    ).toThrow(/Workspace not trusted/);
  });

  it("lists running sessions only", () => {
    const { run } = fakeRunner(replyAgents);
    expect(
      createLauncher({ run, scope: false })
        .list()
        .map((s) => s.name),
    ).toEqual(["web"]);
  });

  it("stops and attaches by id, and reports status", () => {
    const { run, calls } = fakeRunner(replyAgents);
    const launcher = createLauncher({ run, scope: false });
    launcher.stop("web");
    expect(calls.at(-1)?.args).toEqual(["stop", "c9a41849"]);
    expect(launcher.attachCommand("docs")).toEqual([
      "claude",
      "attach",
      "1bcf52d6",
    ]);
    expect(launcher.status("web")).toBe("running");
    expect(launcher.status("docs")).toBe("stopped");
    expect(launcher.status("nope")).toBe("absent");
    expect(() => launcher.stop("docs")).toThrow(/not running/);
  });

  it("rejects names tmux or a shell would mangle", () => {
    const { run } = fakeRunner(replyAgents);
    const launcher = createLauncher({ run, scope: false });
    expect(() => launcher.start("a.b", "/p")).toThrow(/invalid session name/);
    expect(() => launcher.stop("-rf")).toThrow(/invalid session name/);
  });
});

describe("tmux launcher", () => {
  it("starts claude directly in a scoped detached session on its own socket", () => {
    const { run, calls } = fakeRunner((argv) =>
      argv.includes("list-sessions") ? { status: 1 } : {},
    );
    createLauncher({ backend: "tmux", run, scope: true }).start("web", "/p/b");
    const last = calls.at(-1);
    expect([last?.cmd, ...(last?.args ?? [])]).toEqual([
      ...SCOPE_PREFIX,
      "tmux",
      "-L",
      "claudjar",
      "new-session",
      "-d",
      "-s",
      "web",
      "-c",
      "/p/b",
      "claude",
      "--remote-control",
      "web",
      "--dangerously-skip-permissions",
      "--name",
      "web",
    ]);
  });

  it("treats a missing server as no sessions", () => {
    const { run } = fakeRunner(() => ({
      status: 1,
      stderr: "no server running",
    }));
    const launcher = createLauncher({ backend: "tmux", run, scope: false });
    expect(launcher.list()).toEqual([]);
    expect(launcher.status("web")).toBe("absent");
  });

  it("lists, stops and attaches with exact-match targets", () => {
    const { run, calls } = fakeRunner((argv) =>
      argv.includes("list-sessions") ? { stdout: "web\t/p/b\t0\n" } : {},
    );
    const launcher = createLauncher({
      backend: "tmux",
      run,
      scope: false,
      tmuxSocket: "test",
    });
    expect(launcher.status("web")).toBe("running");
    expect(() => launcher.start("web", "/p")).toThrow(/already running/);
    launcher.stop("web");
    expect(calls.at(-1)?.args).toEqual([
      "-L",
      "test",
      "kill-session",
      "-t",
      "=web",
    ]);
    expect(launcher.attachCommand("web")).toEqual([
      "tmux",
      "-L",
      "test",
      "attach-session",
      "-t",
      "=web",
    ]);
  });
});
