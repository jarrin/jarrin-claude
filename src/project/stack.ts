import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { loadEffectiveConfig } from "../config/load.js";
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

/** SessionStart `source` on which the assigned port is surfaced in context. */
export function showsPort(source: string): boolean {
  return source === "startup" || source === "clear";
}

/**
 * The outcome of a stack teardown: what ran, where, and how it exited. `null`
 * from {@link stopStackAt} means nothing ran at all.
 */
export interface StackTeardown {
  readonly name: string;
  readonly port: number;
  readonly command: string;
  readonly status: number;
}

/**
 * Tear down the project stack of the worktree rooted at `worktreeRoot`, reading
 * that worktree's OWN merged config — its stamped `worktree.name` / `worktree.port`
 * live in its gitignored `.jarrin.local.yml`, so the teardown always uses the port
 * that worktree was actually assigned, not the caller's.
 *
 * Returns `null` when there is nothing to do (no stamped worktree identity, no
 * usable port, or no `exit` command configured) — deleting a worktree that never
 * ran a stack is not an error.
 */
export function stopStackAt(
  worktreeRoot: string,
  proc: NodeJS.Process,
): StackTeardown | null {
  const cfg = loadEffectiveConfig(join(worktreeRoot, ".claude")).merged;
  const stack = resolveStack(cfg);
  if (!stack.active || !stack.exit) return null;
  const status = runStackCommand(stack.exit, stack.port, worktreeRoot, proc);
  return {
    name: stack.name,
    port: stack.port,
    command: stack.exit,
    status,
  };
}

/** One-line status injected into a session's context on startup / clear. */
export function stackStatusText(name: string, port: number): string {
  return (
    `## Project stack\n\n` +
    `Worktree \`${name}\` is assigned ${PORT_ENV}=**${String(port)}**. The stack ` +
    `is started and stopped by hand — \`claudjar start\` / \`claudjar stop\` — and ` +
    `is torn down automatically when the worktree is merged away.`
  );
}
