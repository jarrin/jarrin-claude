import {
  existsSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { lock } from "proper-lockfile";

import type { SessionLauncher } from "./launcher.js";

/**
 * Claude Code's workspace trust, as far as claudjar touches it.
 *
 * Trust is stored per path in `~/.claude.json` as
 * `projects["<abs path>"].hasTrustDialogAccepted`, and a path is trusted when it
 * or any ancestor carries the flag. An untrusted cwd makes `claude --bg` fail
 * fast ("Workspace not trusted") and leaves a tmux session parked at the
 * prompt, so a background session needs trust before it starts.
 *
 * The policy is deliberately narrow: claudjar never trusts a checkout nobody
 * trusted. A new worktree *inherits* trust from the checkout it was cut from
 * (same repo, same commit) — that is the only write. An untrusted checkout gets
 * a clear "run `claude` there once" error instead of a silent pre-trust.
 */

/** `$CLAUDE_CONFIG_DIR/.claude.json`, else `~/.claude.json` — where Claude Code keeps it. */
export function claudeConfigPath(env: NodeJS.ProcessEnv): string {
  const dir = env.CLAUDE_CONFIG_DIR;
  return dir ? join(dir, ".claude.json") : join(homedir(), ".claude.json");
}

interface ProjectEntry {
  hasTrustDialogAccepted?: unknown;
  [key: string]: unknown;
}

interface ClaudeConfig {
  projects?: Record<string, ProjectEntry>;
  [key: string]: unknown;
}

function readConfig(file: string): ClaudeConfig | null {
  if (!existsSync(file)) return null;
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return null;
  return parsed as ClaudeConfig;
}

/** `path` and its ancestors, nearest first. */
function ancestors(path: string): string[] {
  const out: string[] = [];
  let p = resolve(path);
  for (;;) {
    out.push(p);
    const parent = dirname(p);
    if (parent === p) return out;
    p = parent;
  }
}

/** Whether Claude Code trusts `path` (directly or through an ancestor). */
export function isTrusted(configFile: string, path: string): boolean {
  let config: ClaudeConfig | null;
  try {
    config = readConfig(configFile);
  } catch {
    return false;
  }
  const projects = config?.projects ?? {};
  return ancestors(path).some(
    (p) => projects[p]?.hasTrustDialogAccepted === true,
  );
}

/**
 * Mark `path` trusted. A read-modify-write under `proper-lockfile`'s
 * `<file>.lock`, written to a temp file and renamed over the original, since
 * live sessions write the same file. Answers whether it wrote anything: a
 * missing config, or a path already flagged, is left alone.
 */
export async function trustWorkspace(
  configFile: string,
  path: string,
): Promise<boolean> {
  if (!existsSync(configFile)) return false;
  const target = realpathSync(configFile);
  const release = await lock(target, {
    retries: { retries: 20, minTimeout: 25, maxTimeout: 250 },
    stale: 10_000,
  });
  try {
    const config = readConfig(target);
    if (!config) return false;
    const key = resolve(path);
    const projects = config.projects ?? {};
    const entry = projects[key] ?? {};
    if (entry.hasTrustDialogAccepted === true) return false;
    config.projects = {
      ...projects,
      [key]: { ...entry, hasTrustDialogAccepted: true },
    };
    const tmp = `${target}.claudjar-${String(process.pid)}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(tmp, target);
    return true;
  } finally {
    await release();
  }
}

/** The error a session start in an untrusted workspace fails with. */
export function untrustedError(cwd: string): string {
  return (
    `workspace ${cwd} is not trusted by Claude Code — run \`claude\` there ` +
    `once and accept the trust prompt, then try again`
  );
}

/**
 * A launcher whose `start` refuses an untrusted cwd up front, with an error
 * that says what to do — rather than `--bg`'s terser failure, or a tmux
 * session silently waiting at the trust prompt.
 */
export function requireTrust(
  launcher: SessionLauncher,
  trusted: (cwd: string) => boolean,
): SessionLauncher {
  return {
    backend: launcher.backend,
    start: (name, cwd) => {
      if (!trusted(cwd)) throw new Error(untrustedError(cwd));
      return launcher.start(name, cwd);
    },
    list: () => launcher.list(),
    attachCommand: (name) => launcher.attachCommand(name),
    stop: (name) => {
      launcher.stop(name);
    },
    status: (name) => launcher.status(name),
  };
}
