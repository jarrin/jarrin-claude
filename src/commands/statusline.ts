import { basename, join } from "node:path";

import { buildCommand } from "@stricli/core";

import { loadEffectiveConfig } from "../config/load.js";
import type { LocalContext } from "../context.js";
import { currentBranch, toplevel } from "../git.js";
import { probePort } from "../project/liveness.js";
import { effectivePort } from "../project/stack.js";

/**
 * The subset of the Claude Code statusLine stdin JSON we read. Claude passes the
 * whole `Status` hook payload; we only need the model label and the working dir.
 * `workspace.current_dir` is the session's cwd (repo root); `cwd` is the legacy
 * fallback. Everything is optional — a missing field degrades to a sensible
 * default rather than an error.
 */
interface StatusPayload {
  readonly model?: { readonly display_name?: string };
  readonly workspace?: { readonly current_dir?: string };
  readonly cwd?: string;
}

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";

/** ` · ` in dim, the segment separator. */
const SEP = `${DIM} · ${RESET}`;

/** The resolved facts a statusline is built from — the pure formatter's input. */
export interface StatuslineData {
  readonly modelName: string;
  /** Basename of the repo root (or working dir when not in a repo). */
  readonly dirName: string;
  /** Current branch, or null outside a repo / on a detached HEAD. */
  readonly branch: string | null;
  /** Stamped worktree name; "" in the main checkout / non-jarrin repos. */
  readonly worktreeName: string;
  /** Effective PROJECT_PORT; 0 when unset. */
  readonly port: number;
  /**
   * Is the stack actually listening on {@link port}? `null` when no probe was
   * possible (no port assigned), which renders the name with no port at all.
   */
  readonly up: boolean | null;
}

/** Filled dot = stack listening; hollow dot = port assigned but nothing there. */
const UP_MARK = "●";
const DOWN_MARK = "○";

/**
 * Format the statusline string from already-resolved facts. Always shows
 * `model · dir · branch`; appends a `⑂ name ●port` segment when a stamped worktree
 * identity is present — i.e. inside a `claudjar worktree create` worktree. In the
 * main checkout, and in any repo without a `.jarrin.local.yml` stamp, the worktree
 * segment is absent, so the line stays useful everywhere the global settings apply.
 *
 * The dot reports liveness, not configuration: since nothing starts the stack
 * automatically any more, a green `●` is the only honest signal that `claudjar
 * start` has actually been run in this worktree. A dim `○` means the port is
 * assigned but unserved.
 */
export function formatStatusline(data: StatuslineData): string {
  const parts: string[] = [`${DIM}${data.modelName}${RESET}`, data.dirName];
  if (data.branch) parts.push(`${CYAN}${data.branch}${RESET}`);

  let line = parts.join(SEP);

  if (data.worktreeName) {
    let portLabel = "";
    if (data.port > 0) {
      const port = String(data.port);
      portLabel =
        data.up === true
          ? ` ${GREEN}${UP_MARK}${YELLOW}${port}${RESET}`
          : ` ${DIM}${DOWN_MARK}${port}${RESET}`;
    }
    line += `  ${BOLD}${YELLOW}⑂ ${data.worktreeName}${RESET}${portLabel}${RESET}`;
  }

  return line;
}

/**
 * Gather the statusline facts for a working directory, then format them. Async
 * because the liveness dot needs a TCP probe; the probe is skipped entirely
 * outside a stamped worktree, so the common case costs nothing.
 */
export async function renderStatusline(
  dir: string,
  modelName: string,
): Promise<string> {
  const root = toplevel(dir) ?? dir;
  const cfg = loadEffectiveConfig(join(root, ".claude")).merged;
  const worktreeName = cfg.worktree.name;
  const port = effectivePort(cfg);
  const up = worktreeName && port > 0 ? await probePort(port) : null;

  return formatStatusline({
    modelName,
    dirName: basename(root),
    branch: currentBranch(root),
    worktreeName,
    port,
    up,
  });
}

async function readPayload(proc: NodeJS.Process): Promise<StatusPayload> {
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

/**
 * statusLine command. Reads the Claude Code `Status` JSON payload from stdin and
 * writes the single-line statusline to stdout. Registered in
 * `claude/settings.json` under `statusLine`, launched via `claudjar api statusline` on PATH.
 */
async function runStatusline(this: LocalContext): Promise<void> {
  const proc = this.process;
  const payload = await readPayload(proc);
  const dir = payload.workspace?.current_dir ?? payload.cwd ?? proc.cwd();
  const modelName = payload.model?.display_name?.trim() || "claude";
  proc.stdout.write((await renderStatusline(dir, modelName)) + "\n");
}

export const statuslineCommand = buildCommand({
  func: runStatusline,
  parameters: { flags: {} },
  docs: {
    brief:
      "[internal] statusLine: render model · dir · branch, plus worktree name+port (reads stdin JSON)",
    fullDescription:
      "INTERNAL — invoked by Claude Code as `claudjar api statusline` on every " +
      "render; not for manual use.\n\n" +
      "Reads the statusLine payload on stdin and writes one line to stdout. Inside a " +
      "stamped worktree it appends the worktree name and probes its PROJECT_PORT, " +
      "showing a green ● when the project stack is listening and a dim ○ when it is " +
      "not — the only signal that `claudjar start` has actually been run.",
  },
});
