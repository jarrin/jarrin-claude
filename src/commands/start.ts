import { join } from "node:path";

import { buildCommand } from "@stricli/core";

import { loadEffectiveConfig } from "../config/load.js";
import type { LocalContext } from "../context.js";
import { toplevel } from "../git.js";
import { resolveStack, runStackCommand } from "../project/stack.js";

type Lifecycle = "start" | "exit";

/**
 * Shared body for `claudjar start` / `claudjar stop`: resolve the current
 * worktree's project stack and run its start/exit command with PROJECT_PORT set.
 * A no-op (exit 0) in the main checkout or when the command is unconfigured — the
 * main repo is deliberately never affected.
 */
function runLifecycle(ctx: LocalContext, kind: Lifecycle): void {
  const proc = ctx.process;
  const out = (msg: string): void => void proc.stdout.write(msg);

  const repoRoot = toplevel(proc.cwd());
  if (!repoRoot) {
    proc.stderr.write(`${kind}: not inside a git repository.\n`);
    proc.exitCode = 1;
    return;
  }

  const cfg = loadEffectiveConfig(join(repoRoot, ".claude")).merged;
  const stack = resolveStack(cfg);
  if (!stack.active) {
    out(
      "No project stack for this checkout (the main repo is not affected; only " +
        "worktrees created by `claudjar worktree create` run a stack).\n",
    );
    return;
  }

  const command = kind === "start" ? stack.start : stack.exit;
  if (!command) {
    out(`No project.commands.${kind} configured; nothing to run.\n`);
    return;
  }

  out(
    `${kind === "start" ? "Starting" : "Stopping"} project stack (PROJECT_PORT=${String(stack.port)})…\n`,
  );
  const status = runStackCommand(command, stack.port, repoRoot, proc);
  if (status !== 0) {
    proc.stderr.write(`${kind}: command failed (exit ${String(status)}).\n`);
    proc.exitCode = 1;
  }
}

export const startCommand = buildCommand({
  func: function (this: LocalContext): void {
    runLifecycle(this, "start");
  },
  parameters: { flags: {} },
  docs: {
    brief:
      "Bring up this worktree's project stack (project.commands.start, PROJECT_PORT set)",
  },
});

export const stopCommand = buildCommand({
  func: function (this: LocalContext): void {
    runLifecycle(this, "exit");
  },
  parameters: { flags: {} },
  docs: {
    brief:
      "Tear down this worktree's project stack (project.commands.exit, PROJECT_PORT set)",
  },
});
