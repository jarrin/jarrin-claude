import { join } from "node:path";

import { buildCommand } from "@stricli/core";

import { loadEffectiveConfig } from "../config/load.js";
import type { LocalContext } from "../context.js";
import {
  isExitReason,
  resolveStack,
  runStackCommand,
} from "../project/stack.js";

const TAG = "[jarrin session-end]";

interface HookPayload {
  readonly cwd?: string;
  readonly reason?: string;
}

/**
 * SessionEnd hook. Tears down this worktree's project stack when a Claude shell
 * exits, so the stack lives only as long as the session (see the SessionStart
 * hook's `start`). Runs `project.commands.exit` with PROJECT_PORT set.
 *
 * Two deliberate gates:
 * - Only inside a claudjar-created worktree (`resolveStack().active`) — the main
 *   checkout is never affected.
 * - Never on `reason === "clear"`: `/clear` fires SessionEnd→SessionStart, and a
 *   clear must NOT kill the stack (the new session keeps using it).
 *
 * Emits no stdout; all diagnostics go to stderr.
 */
async function runSessionEnd(this: LocalContext): Promise<void> {
  const proc = this.process;
  const err = (msg: string): void => void proc.stderr.write(msg);

  const payload = await readPayload(proc);
  const cwd = payload.cwd ?? proc.cwd();
  const reason = payload.reason ?? "";
  if (!isExitReason(reason)) return; // a /clear must not tear the stack down

  const cfg = loadEffectiveConfig(join(cwd, ".claude")).merged;
  const stack = resolveStack(cfg);
  if (!stack.active || !stack.exit) return;

  err(
    `${TAG} stopping project stack (PROJECT_PORT=${String(stack.port)}): ${stack.exit}\n`,
  );
  const status = runStackCommand(stack.exit, stack.port, cwd, proc);
  if (status !== 0) {
    err(`${TAG} WARNING: exit command exited ${String(status)}.\n`);
  }
}

async function readPayload(proc: NodeJS.Process): Promise<HookPayload> {
  if (proc.stdin.isTTY) return {};
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of proc.stdin) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    const text = Buffer.concat(chunks).toString("utf8").trim();
    if (!text) return {};
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Unreadable/invalid stdin — behave as if no payload was supplied.
  }
  return {};
}

export const sessionEndCommand = buildCommand({
  func: runSessionEnd,
  parameters: { flags: {} },
  docs: {
    brief:
      "SessionEnd hook: tear down this worktree's project stack (reads stdin JSON)",
  },
});
