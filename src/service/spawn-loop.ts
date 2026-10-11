import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isSea } from "node:sea";

import { SCOPE_PREFIX } from "../session/launcher.js";
import type { LoopSpec } from "./worktrees.js";

/**
 * Launching a `claudjar loop` from the service, for `create-worktree` with
 * `mode: "loop"`.
 *
 * The loop must outlive a service restart, for the same reason the sessions
 * do (Stage 1): stopping the unit kills everything in its cgroup. So it runs
 * under `systemd-run --user --scope`, which moves it into a scope of its own.
 * In scope mode `systemd-run` execs the command in place, so the pid spawned
 * is the loop's own pid — the one its monitor instance reports, and what pins
 * the worktree to that instance.
 *
 * The loop's output goes to a log file, not the service's journal: it runs for
 * hours and is not the service's to narrate.
 */

export interface LoopLaunch {
  /** The claudjar invocation: the SEA binary, or `node <script>` from source. */
  readonly bin: readonly string[];
  /** Wrap in `systemd-run --user --scope` (see {@link scopeAvailable}). */
  readonly scope: boolean;
  /** Where loop logs go: `<logDir>/<label>.log`. */
  readonly logDir: string;
  readonly monitorUrl: string;
  readonly monitorToken: string;
  readonly env: NodeJS.ProcessEnv;
  /** How long the loop must survive before it counts as started. */
  readonly settleMs?: number;
}

/** This process's own claudjar command line. */
export function selfCommand(
  proc: Pick<NodeJS.Process, "execPath" | "argv">,
): string[] {
  const script = proc.argv[1];
  return isSea() || !script ? [proc.execPath] : [proc.execPath, script];
}

/** The argv that starts the loop; the milestone goes by id, which is exact. */
export function loopArgv(
  launch: Pick<LoopLaunch, "bin" | "scope" | "monitorUrl">,
  spec: Pick<LoopSpec, "repo" | "milestone">,
): string[] {
  return [
    ...(launch.scope ? SCOPE_PREFIX : []),
    ...launch.bin,
    "loop",
    String(spec.milestone.id),
    "--repo",
    spec.repo,
    "--monitor",
    launch.monitorUrl,
  ];
}

/** The log file of a loop labelled `<project>/<worktree>`. */
export function loopLogPath(logDir: string, label: string): string {
  return join(logDir, `${label.replaceAll("/", "--")}.log`);
}

/** The last few non-empty lines of a log, for a loop that died on start. */
function tail(path: string, lines = 3): string {
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.trim() !== "")
      .slice(-lines)
      .join(" / ");
  } catch {
    return "";
  }
}

/**
 * Start the loop detached and wait `settleMs` for it to fail fast — a lock
 * held by another loop, missing credentials, an unreachable monitor — so that
 * failure reaches the web interface instead of a silent dead pid.
 */
export function spawnLoop(
  launch: LoopLaunch,
  spec: LoopSpec,
): Promise<{ readonly pid: number; readonly log: string }> {
  mkdirSync(launch.logDir, { recursive: true });
  const log = loopLogPath(launch.logDir, spec.label);
  const fd = openSync(log, "a");
  const [cmd = "", ...args] = loopArgv(launch, spec);
  const child = spawn(cmd, args, {
    cwd: spec.cwd,
    detached: true,
    stdio: ["ignore", fd, fd],
    env: { ...launch.env, CLAUDJAR_MONITOR_TOKEN: launch.monitorToken },
  });
  closeSync(fd);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.removeAllListeners();
      child.unref();
      if (child.pid === undefined) reject(new Error("the loop has no pid"));
      else resolve({ pid: child.pid, log });
    }, launch.settleMs ?? 2000);
    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      const why = tail(log);
      reject(
        new Error(
          `the loop exited at once (code ${String(code ?? "?")})${why ? `: ${why}` : ""}`,
        ),
      );
    });
  });
}

/**
 * Abort a loop: SIGTERM it — which the loop takes as a graceful abort (its
 * session ends, its work is stashed, its locks are released) — and wait up to
 * `timeoutMs` for it to exit. False when it is still running by then; nothing
 * escalates to SIGKILL, since that would skip the stash.
 */
export async function stopLoopProcess(
  pid: number,
  isAlive: (pid: number) => boolean,
  opts: { readonly timeoutMs?: number; readonly pollMs?: number } = {},
): Promise<boolean> {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return !isAlive(pid);
  }
  const deadline = Date.now() + (opts.timeoutMs ?? 45_000);
  while (isAlive(pid)) {
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, opts.pollMs ?? 250));
  }
  return true;
}
