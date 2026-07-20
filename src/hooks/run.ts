import { spawnSync } from "node:child_process";

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
  /** Extra environment merged over the process env for every command. */
  readonly env: Readonly<Record<string, string>>;
}

/**
 * Run `commands` in `ctx.cwd`, stopping at the first non-zero exit. `out` is
 * called with a one-line echo of each command before it runs, so the caller
 * controls where that narration goes.
 */
export function runHooks(
  commands: readonly string[],
  ctx: HookEnv,
  proc: NodeJS.Process,
  out: (msg: string) => void,
): HookOutcome {
  const ran: HookRun[] = [];
  for (const command of commands) {
    out(`  $ ${command}\n`);
    const res = spawnSync(command, {
      cwd: ctx.cwd,
      shell: true,
      stdio: "inherit",
      env: { ...proc.env, ...ctx.env },
    });
    const status = res.error ? 1 : (res.status ?? 1);
    if (res.error) {
      proc.stderr.write(`  ! failed to launch: ${res.error.message}\n`);
    }
    const run: HookRun = { command, status };
    ran.push(run);
    if (status !== 0) return { ok: false, ran, failed: run };
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
