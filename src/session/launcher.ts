import { spawnSync } from "node:child_process";

/**
 * Launch named Claude sessions in the background, reachable from the Claude
 * mobile / web app through Remote Control and running without permission prompts.
 *
 * Two backends sit behind one interface:
 *
 * - **`bg`** (default) — Claude Code's own background sessions: `claude --bg`
 *   hands the session to a supervisor daemon, `claude agents --json` lists it,
 *   `claude attach` / `claude stop` drive it. `--bg` combines with
 *   `--remote-control <name>` and `--dangerously-skip-permissions`; verified on
 *   2.1.296, also with no prompt (the session starts idle).
 * - **`tmux`** — the fallback: an interactive `claude --remote-control` in a
 *   detached session on claudjar's own tmux socket.
 *
 * Both spawn a long-lived process (the bg daemon, the tmux server) into the
 * caller's cgroup. Under a systemd unit that cgroup is killed on stop or
 * restart, taking every session with it — so each spawning call is wrapped in
 * `systemd-run --user --scope`, which gives the process a cgroup of its own.
 * `claude agents` and `claude stop` can start the daemon too, so every `claude`
 * call is wrapped, not only `start`.
 *
 * Workspace trust is not handled here: `claude --bg` in an untrusted directory
 * fails fast with "Workspace not trusted", which surfaces as a start error.
 * `requireTrust` (`./trust.ts`) wraps a launcher to refuse such a start up
 * front with instructions; the service uses that wrapper.
 */

export interface ProcResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type ProcRunner = (
  cmd: string,
  args: readonly string[],
  cwd?: string,
) => ProcResult;

/** Run a command with captured output. A missing binary reads as status 1. */
export const spawnRunner: ProcRunner = (cmd, args, cwd) => {
  const res = spawnSync(cmd, [...args], { cwd, encoding: "utf8" });
  if (res.error) return { status: 1, stdout: "", stderr: res.error.message };
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
};

export type SessionBackend = "bg" | "tmux";

export type SessionStatus = "running" | "stopped" | "absent";

export interface SessionInfo {
  readonly name: string;
  /** The backend's handle: the bg session id, or the tmux session name. */
  readonly id: string;
  readonly cwd: string;
  readonly running: boolean;
  /** Backend-reported state (bg: working / blocked / done / failed). */
  readonly state: string;
}

export interface SessionLauncher {
  readonly backend: SessionBackend;
  start(name: string, cwd: string): SessionInfo;
  /** Sessions currently running. */
  list(): SessionInfo[];
  /** The argv a person runs to open the session in their terminal. */
  attachCommand(name: string): string[];
  stop(name: string): void;
  status(name: string): SessionStatus;
}

export interface LauncherOptions {
  readonly backend?: SessionBackend;
  readonly run?: ProcRunner;
  readonly claudeBin?: string;
  readonly tmuxBin?: string;
  /** tmux `-L` socket name, so claudjar's sessions never mix with the user's. */
  readonly tmuxSocket?: string;
  /** Wrap spawning calls in `systemd-run --user --scope`. Default: detected. */
  readonly scope?: boolean;
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** tmux rejects `.` and `:` in session names; keep one rule for both backends. */
export function assertSessionName(name: string): void {
  if (!NAME.test(name)) {
    throw new Error(
      `invalid session name "${name}": use letters, digits, "-" and "_"`,
    );
  }
}

/** The flags that make a session remote-controllable and prompt-free. */
export function claudeSessionArgs(name: string): string[] {
  return [
    "--remote-control",
    name,
    "--dangerously-skip-permissions",
    "--name",
    name,
  ];
}

export const SCOPE_PREFIX = [
  "systemd-run",
  "--user",
  "--scope",
  "--collect",
  "--quiet",
  "--",
] as const;

/** Whether `systemd-run --user --scope` works here (a user manager is running). */
export function scopeAvailable(run: ProcRunner): boolean {
  return run("systemd-run", [...SCOPE_PREFIX.slice(1), "true"]).status === 0;
}

function fail(what: string, res: ProcResult): never {
  const detail = (res.stderr.trim() || res.stdout.trim()).split("\n")[0];
  throw new Error(`${what} failed${detail ? `: ${detail}` : ""}`);
}

export function createLauncher(opts: LauncherOptions = {}): SessionLauncher {
  const run = opts.run ?? spawnRunner;
  let scope = opts.scope;
  const scoped = (
    cmd: string,
    args: readonly string[],
    cwd?: string,
  ): ProcResult => {
    scope ??= scopeAvailable(run);
    return scope
      ? run(SCOPE_PREFIX[0], [...SCOPE_PREFIX.slice(1), cmd, ...args], cwd)
      : run(cmd, args, cwd);
  };
  return (opts.backend ?? "bg") === "bg"
    ? bgLauncher(opts.claudeBin ?? "claude", scoped)
    : tmuxLauncher(
        opts.claudeBin ?? "claude",
        opts.tmuxBin ?? "tmux",
        opts.tmuxSocket ?? "claudjar",
        run,
        scoped,
      );
}

// --- bg backend -------------------------------------------------------------

interface AgentEntry {
  readonly id?: string;
  readonly sessionId: string;
  readonly name?: string;
  readonly cwd: string;
  readonly kind: string;
  readonly pid?: number;
  readonly state?: string;
}

function isAgentEntry(v: unknown): v is AgentEntry {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.sessionId === "string" &&
    typeof o.cwd === "string" &&
    typeof o.kind === "string" &&
    (o.id === undefined || typeof o.id === "string") &&
    (o.name === undefined || typeof o.name === "string") &&
    (o.pid === undefined || typeof o.pid === "number") &&
    (o.state === undefined || typeof o.state === "string")
  );
}

/**
 * Parse `claude agents --json [--all]` into background sessions. Interactive
 * sessions are listed there too and are dropped; a live session carries a
 * `pid`, a finished one only its last `state`.
 */
export function parseAgents(json: string): SessionInfo[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) {
    throw new Error("claude agents --json: expected an array");
  }
  return data
    .filter(isAgentEntry)
    .filter((a) => a.kind === "background")
    .map((a) => ({
      name: a.name ?? "",
      id: a.id ?? a.sessionId.slice(0, 8),
      cwd: a.cwd,
      running: a.pid !== undefined,
      state: a.state ?? "unknown",
    }));
}

/** The session id from `claude --bg`'s `backgrounded · <id> · <name>` line. */
export function parseBackgrounded(stdout: string): string | null {
  return /backgrounded · ([0-9a-f]+) ·/.exec(stdout)?.[1] ?? null;
}

function bgLauncher(claude: string, scoped: ProcRunner): SessionLauncher {
  const agents = (all: boolean): SessionInfo[] => {
    const res = scoped(claude, ["agents", "--json", ...(all ? ["--all"] : [])]);
    if (res.status !== 0) fail("claude agents", res);
    return parseAgents(res.stdout);
  };
  // Without --all the list still carries dormant sessions (no pid): liveness
  // is the pid, never presence in the list.
  const list = (): SessionInfo[] => agents(false).filter((s) => s.running);
  const live = (name: string): SessionInfo | undefined =>
    list().find((s) => s.name === name);
  // Several finished sessions can share a name; a live one wins, else the
  // newest, which is last in the list.
  const latest = (name: string): SessionInfo | undefined => {
    const named = agents(true).filter((s) => s.name === name);
    return named.find((s) => s.running) ?? named.at(-1);
  };

  return {
    backend: "bg",
    start(name, cwd) {
      assertSessionName(name);
      if (live(name)) {
        throw new Error(`session "${name}" is already running`);
      }
      const res = scoped(claude, ["--bg", ...claudeSessionArgs(name)], cwd);
      const id = parseBackgrounded(res.stdout);
      if (res.status !== 0 || id === null) fail(`claude --bg ${name}`, res);
      return { name, id, cwd, running: true, state: "idle" };
    },
    list,
    attachCommand(name) {
      assertSessionName(name);
      return [claude, "attach", latest(name)?.id ?? name];
    },
    stop(name) {
      assertSessionName(name);
      const s = live(name);
      if (!s) throw new Error(`session "${name}" is not running`);
      const res = scoped(claude, ["stop", s.id]);
      if (res.status !== 0) fail(`claude stop ${s.id}`, res);
    },
    status(name) {
      assertSessionName(name);
      const s = latest(name);
      if (!s) return "absent";
      return s.running ? "running" : "stopped";
    },
  };
}

// --- tmux backend -----------------------------------------------------------

const TMUX_FORMAT =
  "#{session_name}\t#{pane_current_path}\t#{session_attached}";

/** Parse `tmux list-sessions -F TMUX_FORMAT`. */
export function parseTmuxSessions(stdout: string): SessionInfo[] {
  return stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [name = "", cwd = "", attached = "0"] = line.split("\t");
      return {
        name,
        id: name,
        cwd,
        running: true,
        state: attached === "0" ? "detached" : "attached",
      };
    });
}

function tmuxLauncher(
  claude: string,
  tmux: string,
  socket: string,
  run: ProcRunner,
  scoped: ProcRunner,
): SessionLauncher {
  const sock = ["-L", socket];
  const list = (): SessionInfo[] => {
    const res = run(tmux, [...sock, "list-sessions", "-F", TMUX_FORMAT]);
    // No server on the socket means no sessions, not an error.
    if (res.status !== 0) return [];
    return parseTmuxSessions(res.stdout);
  };
  const has = (name: string): boolean => list().some((s) => s.name === name);

  return {
    backend: "tmux",
    start(name, cwd) {
      assertSessionName(name);
      if (has(name)) throw new Error(`session "${name}" is already running`);
      // tmux ≥ 3.0 execs a multi-argument command directly: no shell quoting.
      const res = scoped(tmux, [
        ...sock,
        "new-session",
        "-d",
        "-s",
        name,
        "-c",
        cwd,
        claude,
        ...claudeSessionArgs(name),
      ]);
      if (res.status !== 0) fail(`tmux new-session ${name}`, res);
      return { name, id: name, cwd, running: true, state: "detached" };
    },
    list,
    attachCommand(name) {
      assertSessionName(name);
      return [tmux, ...sock, "attach-session", "-t", `=${name}`];
    },
    stop(name) {
      assertSessionName(name);
      const res = run(tmux, [...sock, "kill-session", "-t", `=${name}`]);
      if (res.status !== 0) fail(`tmux kill-session ${name}`, res);
    },
    // A tmux session leaves nothing behind once killed: never "stopped".
    status: (name) => {
      assertSessionName(name);
      return has(name) ? "running" : "absent";
    },
  };
}

/**
 * One launcher per backend, created on first use — so the `systemd-run` scope
 * probe runs once per process, not once per command.
 */
export function launcherCache(
  opts: Omit<LauncherOptions, "backend"> = {},
): (backend: SessionBackend) => SessionLauncher {
  const made = new Map<SessionBackend, SessionLauncher>();
  return (backend) => {
    let launcher = made.get(backend);
    if (!launcher) {
      launcher = createLauncher({ ...opts, backend });
      made.set(backend, launcher);
    }
    return launcher;
  };
}
