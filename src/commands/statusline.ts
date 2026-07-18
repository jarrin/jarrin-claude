import { basename, join } from "node:path";

import { buildCommand } from "@stricli/core";

import { loadEffectiveConfig } from "../config/load.js";
import type { LocalContext } from "../context.js";
import { currentBranch, toplevel } from "../git.js";
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
}

/**
 * Format the statusline string from already-resolved facts. Always shows
 * `model · dir · branch`; appends a `⑂ name :port` segment when a stamped worktree
 * identity is present — i.e. inside a `claudjar worktree create` worktree. In the
 * main checkout, and in any repo without a `.jarrin.local.yml` stamp, the worktree
 * segment is absent, so the line stays useful everywhere the global settings apply.
 */
export function formatStatusline(data: StatuslineData): string {
  const parts: string[] = [`${DIM}${data.modelName}${RESET}`, data.dirName];
  if (data.branch) parts.push(`${CYAN}${data.branch}${RESET}`);

  let line = parts.join(SEP);

  if (data.worktreeName) {
    const portLabel =
      data.port > 0 ? ` ${DIM}:${RESET}${YELLOW}${String(data.port)}` : "";
    line += `  ${BOLD}${YELLOW}⑂ ${data.worktreeName}${RESET}${portLabel}${RESET}`;
  }

  return line;
}

/** Gather the statusline facts for a working directory, then format them. */
export function renderStatusline(dir: string, modelName: string): string {
  const root = toplevel(dir) ?? dir;
  const cfg = loadEffectiveConfig(join(root, ".claude")).merged;
  return formatStatusline({
    modelName,
    dirName: basename(root),
    branch: currentBranch(root),
    worktreeName: cfg.worktree.name,
    port: effectivePort(cfg),
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
 * `claude/settings.json` under `statusLine`, launched via `~/.claude/bin/statusline`.
 */
async function runStatusline(this: LocalContext): Promise<void> {
  const proc = this.process;
  const payload = await readPayload(proc);
  const dir = payload.workspace?.current_dir ?? payload.cwd ?? proc.cwd();
  const modelName = payload.model?.display_name?.trim() || "claude";
  proc.stdout.write(renderStatusline(dir, modelName) + "\n");
}

export const statuslineCommand = buildCommand({
  func: runStatusline,
  parameters: { flags: {} },
  docs: {
    brief:
      "statusLine hook: render model · dir · branch, plus worktree name+port (reads stdin JSON)",
  },
});
