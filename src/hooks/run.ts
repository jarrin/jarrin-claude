import type { CommandRunner } from "../worktree/runner.js";

/**
 * Runner for the `hooks:` block — shell commands the CLI fires at lifecycle
 * points (currently worktree create / remove).
 *
 * Commands run **in declaration order and stop at the first failure**, matching
 * `worktree.setup`: a hook chain is a recipe, and continuing past a failed step
 * would run later steps against a half-built state. Output is inherited rather
 * than captured so long-running hooks (installs, container builds) stream
 * progress live.
 */

/** One executed hook command and how it exited. */
export interface HookRun {
  readonly command: string;
  readonly status: number;
}

export interface HookOutcome {
  readonly ok: boolean;
  /** Commands that actually ran, in order — including the failing one. */
  readonly ran: readonly HookRun[];
  /** The command that stopped the chain, or null when all succeeded. */
  readonly failed: HookRun | null;
}

export interface HookEnv {
  readonly cwd: string;
  /** Extra environment merged over the runner's base env for every command. */
  readonly env: Readonly<Record<string, string>>;
}

/** Where hook narration and launch failures are reported. */
export interface HookIO {
  readonly run: CommandRunner;
  /** Called with a one-line echo of each command before it runs. */
  readonly log: (msg: string) => void;
  /** Called when a command fails to launch at all. */
  readonly warn: (msg: string) => void;
}

/**
 * Run `commands` in `ctx.cwd`, stopping at the first non-zero exit. The caller
 * controls where the narration goes and what actually spawns the commands.
 */
export async function runHooks(
  commands: readonly string[],
  ctx: HookEnv,
  io: HookIO,
): Promise<HookOutcome> {
  const ran: HookRun[] = [];
  for (const command of commands) {
    io.log(`  $ ${command}\n`);
    const res = await io.run({ command, cwd: ctx.cwd, env: ctx.env });
    if (res.error) io.warn(`  ! failed to launch: ${res.error}\n`);
    const run: HookRun = { command, status: res.status };
    ran.push(run);
    if (run.status !== 0) return { ok: false, ran, failed: run };
  }
  return { ok: true, ran, failed: null };
}

/** A worktree's identity, as a hook sees it. */
export interface WorktreeIdentity {
  readonly name: string;
  readonly path: string;
  readonly port: number;
}

/**
 * The environment every worktree hook receives: which worktree it concerns,
 * where it lived, and the port it was assigned. `remove` hooks run after the
 * directory is gone, so `WORKTREE_PATH` there names a path that no longer
 * exists — deliberately, since cleaning up by path is the common case.
 *
 * `source` is the worktree the command ran in — the one the new branch was cut
 * from — and is passed on **create** only, as `SOURCE_*`. Creation is
 * directional (main → dev → dev-x), so a hook that carries state forward (a
 * database, a cache, a fixture set) needs to name where to carry it *from*, and
 * the destination's own identity cannot tell it. The main checkout is the source
 * with an empty `SOURCE_WORKTREE_NAME` and `SOURCE_PROJECT_PORT=0`, matching how
 * an unstamped `worktree:` block reads everywhere else.
 */
export function worktreeHookEnv(
  identity: WorktreeIdentity,
  source?: WorktreeIdentity,
): Record<string, string> {
  return {
    WORKTREE_NAME: identity.name,
    WORKTREE_PATH: identity.path,
    PROJECT_PORT: String(identity.port),
    ...(source
      ? {
          SOURCE_WORKTREE_NAME: source.name,
          SOURCE_WORKTREE_PATH: source.path,
          SOURCE_PROJECT_PORT: String(source.port),
        }
      : {}),
  };
}
