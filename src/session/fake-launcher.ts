import type {
  SessionBackend,
  SessionInfo,
  SessionLauncher,
} from "./launcher.js";

/**
 * An in-memory {@link SessionLauncher} for tests: `running` is the live set,
 * `calls` records every start / stop, and `failStart` / `failList` make the
 * matching call throw.
 */
export interface FakeLauncher extends SessionLauncher {
  readonly running: Map<string, string>;
  readonly calls: string[];
  failStart: boolean;
  failList: boolean;
}

export function fakeLauncher(backend: SessionBackend = "bg"): FakeLauncher {
  const running = new Map<string, string>();
  const calls: string[] = [];
  const info = (name: string, cwd: string): SessionInfo => ({
    name,
    id: `id-${name}`,
    cwd,
    running: true,
    state: "idle",
  });
  const fake: FakeLauncher = {
    backend,
    running,
    calls,
    failStart: false,
    failList: false,
    start(name, cwd) {
      calls.push(`start ${name} ${cwd}`);
      if (fake.failStart) throw new Error("Workspace not trusted");
      running.set(name, cwd);
      return info(name, cwd);
    },
    list() {
      if (fake.failList) throw new Error("claude agents failed");
      return [...running].map(([name, cwd]) => info(name, cwd));
    },
    attachCommand: (name) => ["claude", "attach", `id-${name}`],
    stop(name) {
      calls.push(`stop ${name}`);
      running.delete(name);
    },
    status: (name) => (running.has(name) ? "running" : "absent"),
  };
  return fake;
}
