import { spawnSync } from "node:child_process";

import type { JarrinConfig } from "../config/schema.js";

/** The environment variable the start/exit commands read for their bound port. */
export const PORT_ENV = "PROJECT_PORT";

/** A resolved view of the `project:` stack for the current worktree. */
export interface ResolvedStack {
  /**
   * True only inside a claudjar-created worktree with a usable port — i.e. the
   * worktree has a stamped `name` and an effective port. The main checkout is
   * never active, so its sessions never touch the stack.
   */
  readonly active: boolean;
  /** The PROJECT_PORT for this worktree (`worktree.port`, else `project.port`). */
  readonly port: number;
  /** Worktree identity, for status messages. */
  readonly name: string;
  readonly start: string;
  readonly exit: string;
}

/** The PROJECT_PORT for this session: the worktree's assignment, else the base. */
export function effectivePort(cfg: JarrinConfig): number {
  return cfg.worktree.port || cfg.project.port;
}

/**
 * Resolve whether the per-worktree stack applies to the current session and, if
 * so, with which port and commands. Gated on a stamped `worktree.name` so the
 * main checkout is always inactive.
 */
export function resolveStack(cfg: JarrinConfig): ResolvedStack {
  const port = effectivePort(cfg);
  return {
    active: cfg.worktree.name !== "" && port > 0,
    port,
    name: cfg.worktree.name,
    start: cfg.project.commands.start,
    exit: cfg.project.commands.exit,
  };
}

/**
 * Run one lifecycle command with `PROJECT_PORT` in the environment, in `cwd`.
 * All output is relayed to **stderr** — never stdout, which the hooks reserve for
 * their JSON payload. Returns the command's exit code (1 if it failed to launch).
 */
export function runStackCommand(
  command: string,
  port: number,
  cwd: string,
  proc: NodeJS.Process,
): number {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: { ...proc.env, [PORT_ENV]: String(port) },
  });
  if (result.stdout) proc.stderr.write(result.stdout);
  if (result.stderr) proc.stderr.write(result.stderr);
  if (result.error) {
    proc.stderr.write(`error launching command: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

/**
 * SessionStart `source` on which the stack's `start` runs: ONLY a genuinely new
 * shell — never `/clear`, `resume`, or `compact` — so the stack's lifetime tracks
 * the shell.
 */
export function isStartSource(source: string): boolean {
  return source === "startup";
}

/** SessionStart `source` on which the running port is surfaced in context. */
export function showsPort(source: string): boolean {
  return source === "startup" || source === "clear";
}

/**
 * SessionEnd `reason` on which the stack's `exit` runs. Everything but `clear`:
 * a `/clear` fires SessionEnd→SessionStart and must NOT tear the stack down.
 */
export function isExitReason(reason: string): boolean {
  return reason !== "clear";
}

/** One-line status injected into a session's context on startup / clear. */
export function stackStatusText(name: string, port: number): string {
  return (
    `## Project stack\n\n` +
    `Worktree \`${name}\` runs its project stack on ${PORT_ENV}=**${String(port)}**.`
  );
}
