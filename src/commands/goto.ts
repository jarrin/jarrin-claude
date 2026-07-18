import { spawnSync } from "node:child_process";

import { buildCommand } from "@stricli/core";

import type { LocalContext } from "../context.js";
import { mainWorktreeRoot, worktreeListPorcelain } from "../git.js";
import { resolveGotoTarget } from "../worktree/goto.js";

/**
 * `claudjar goto <name>` — switch to a worktree by starting a fresh interactive
 * `claude` session inside it. `<name>` is a worktree (branch or directory) name,
 * or `main` for the repo's original checkout.
 *
 * A process cannot change its parent shell's directory, so switching means
 * launching claude there rather than cd-ing: the new session picks up that
 * worktree's stamped identity and PROJECT_PORT through the SessionStart hook,
 * and you land back in the shell you started from when it exits.
 *
 * Resolution goes through the main worktree, so this works identically from the
 * main checkout and from inside any worktree — including hopping sideways from
 * one worktree straight to another.
 */
function runGoto(
  this: LocalContext,
  _flags: Record<never, never>,
  name: string,
): void {
  const proc = this.process;
  const fail = (msg: string): void => {
    proc.stderr.write(`goto: ${msg}\n`);
    proc.exitCode = 1;
  };

  const repoRoot = mainWorktreeRoot(proc.cwd());
  if (!repoRoot) return fail("not inside a git repository.");

  const porcelain = worktreeListPorcelain(repoRoot);
  if (porcelain === null) return fail("`git worktree list` failed.");

  const target = resolveGotoTarget(porcelain, name, repoRoot);
  if (!target.ok) {
    return fail(
      `no worktree named '${name.trim()}'.\n` +
        `Available: ${target.available.join(", ")}`,
    );
  }

  proc.stdout.write(`Switching to ${target.name} (${target.path})…\n`);
  const claude = spawnSync("claude", { cwd: target.path, stdio: "inherit" });
  if (claude.error) {
    return fail(
      `could not launch 'claude' (${claude.error.message}).\n` +
        `cd ${target.path}`,
    );
  }
  if (claude.status !== null && claude.status !== 0) {
    proc.exitCode = claude.status;
  }
}

export const gotoCommand = buildCommand({
  func: runGoto,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief:
            "Worktree name (branch or directory), or 'main' for the original checkout",
          parse: String,
          placeholder: "name",
        },
      ],
    },
    flags: {},
  },
  docs: {
    brief: "Switch to a worktree by starting claude there ('main' goes back)",
  },
});
