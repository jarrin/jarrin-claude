import { spawn } from "node:child_process";
import type { StdioOptions } from "node:child_process";

/**
 * The process runner the worktree library is driven through. Injected rather
 * than imported so the library touches no `process.*` global: the CLI hands it
 * a runner over its own environment and terminal, the service one over its
 * log — and both get the same create / merge / remove behaviour.
 *
 * Asynchronous on purpose. The service is a long-lived event loop, and setup
 * commands and hooks (`pnpm install`, image builds) run for minutes; a
 * `spawnSync` there would freeze every other project it serves.
 */

/** One command to run. */
export interface RunSpec {
  /** The executable — or, when `args` is absent, a shell command line. */
  readonly command: string;
  /** Arguments for `command`; absent means `command` runs through the shell. */
  readonly args?: readonly string[];
  readonly cwd?: string;
  /** Extra environment merged over the runner's base environment. */
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Where the child's output goes:
   * - `inherit` (default) — straight through, so long commands stream live;
   * - `stderr` — the child's stdout is folded onto stderr, for callers whose
   *   stdout is a data channel;
   * - `quiet` — the child's stderr is dropped, for an expected, self-reported
   *   failure (a safe `git branch -d` on an unmerged branch).
   */
  readonly output?: "inherit" | "stderr" | "quiet";
}

/** How a command ended. A command that failed to launch reads as status 1. */
export interface RunResult {
  readonly status: number;
  /** Launch failure (missing binary, bad cwd), or null when it ran. */
  readonly error: string | null;
}

export type CommandRunner = (spec: RunSpec) => Promise<RunResult>;

function stdioFor(output: RunSpec["output"]): StdioOptions {
  switch (output) {
    case "stderr":
      return ["ignore", 2, "inherit"];
    case "quiet":
      return ["inherit", "inherit", "ignore"];
    default:
      return "inherit";
  }
}

/**
 * The default runner: spawn on this machine, with `baseEnv` under every
 * command's own `env`. `baseEnv` is read at call time, not copied, so a caller
 * that adjusts its environment later is still honoured.
 */
export function spawnRunner(
  baseEnv: Readonly<Record<string, string | undefined>>,
): CommandRunner {
  return (spec) =>
    new Promise((resolve) => {
      const options = {
        cwd: spec.cwd,
        env: { ...baseEnv, ...spec.env },
        stdio: stdioFor(spec.output),
      };
      const child = spec.args
        ? spawn(spec.command, [...spec.args], options)
        : spawn(spec.command, { ...options, shell: true });
      // `error` and `close` can both fire for one child; the first settles it.
      child.once("error", (err) => {
        resolve({ status: 1, error: err.message });
      });
      child.once("close", (code) => {
        resolve({ status: code ?? 1, error: null });
      });
    });
}
