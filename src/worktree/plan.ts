import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import { LOCAL_FILE } from "../config/load.js";
import type { WorktreeConfig } from "../config/schema.js";

/** A resolved plan for `worktree create`: where it lands and what to carry in. */
export interface WorktreePlan {
  readonly branch: string;
  /** Absolute path of the new worktree directory. */
  readonly path: string;
  /** Absolute base directory the worktree is created under. */
  readonly baseDir: string;
  /** Repo-relative files to copy in, deduped; always includes the local config. */
  readonly copy: readonly string[];
  /** Setup commands to run in the new worktree, in order. */
  readonly setup: readonly string[];
}

/**
 * `.jarrin.local.yml` is gitignored, so a fresh worktree never has it — always
 * carry it across (and stamp its identity, see `stamp.ts`). Kept relative to
 * `.claude/` to match where the config lives.
 */
const ALWAYS_COPY = [join(".claude", LOCAL_FILE)];

/**
 * Compute the worktree path, branch, copy list and setup commands from the
 * merged {@link WorktreeConfig}. Pure — no filesystem or git access.
 *
 * Default location (`cfg.dir` unset) is the grouped sibling
 * `<parent>/<repo>-worktrees/<name>`. A relative `cfg.dir` resolves against the
 * repo root (so `../` yields a bare sibling); an absolute `cfg.dir` is used as-is.
 */
export function planWorktree(opts: {
  name: string;
  repoRoot: string;
  cfg: WorktreeConfig;
}): WorktreePlan {
  const name = opts.name.trim();
  const baseDir = resolveBaseDir(opts.cfg.dir, opts.repoRoot);
  return {
    branch: name,
    baseDir,
    path: join(baseDir, name),
    copy: dedup([...ALWAYS_COPY, ...opts.cfg.copy]),
    setup: [...opts.cfg.setup],
  };
}

function resolveBaseDir(dir: string, repoRoot: string): string {
  if (dir) return isAbsolute(dir) ? dir : resolve(repoRoot, dir);
  // Grouped-sibling default: <parent>/<repo>-worktrees.
  return join(dirname(repoRoot), `${basename(repoRoot)}-worktrees`);
}

/**
 * Validate a worktree/branch name. Allows git's `feature/x` slashes but rejects
 * the obviously unsafe: empty, leading `-` (parsed as a flag), `..` traversal,
 * and absolute paths. Returns an error string, or null when valid.
 */
export function validateWorktreeName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "name must not be empty";
  if (name.startsWith("-")) return "name must not start with '-'";
  if (isAbsolute(name)) return "name must be relative, not an absolute path";
  if (name.split("/").includes("..")) return "name must not contain '..'";
  return null;
}

function dedup(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
