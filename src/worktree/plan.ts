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
 * Compute the worktree name, path, copy list and setup commands. Pure — no
 * filesystem or git access.
 *
 * `mainRoot` is always the **main** checkout's root, never the worktree the
 * command runs in: the base dir is anchored there so the worktree folder stays
 * flat no matter how deep the chain of creations goes.
 *
 * Default location (`cfg.dir` unset) is the grouped sibling
 * `<parent>/<repo>-worktrees/<name>`. A relative `cfg.dir` resolves against the
 * main root (so `../` yields a bare sibling); an absolute `cfg.dir` is used as-is.
 *
 * `parent` is the stamped identity of the worktree the command runs in ("" in
 * the main checkout). It prefixes the new name — creating `x` from `dev` yields
 * `dev-x` — so a flat folder still records the lineage. See
 * {@link derivedWorktreeName}.
 */
export function planWorktree(opts: {
  name: string;
  parent?: string;
  mainRoot: string;
  cfg: WorktreeConfig;
}): WorktreePlan {
  const name = derivedWorktreeName(opts.parent ?? "", opts.name);
  const baseDir = resolveBaseDir(opts.cfg.dir, opts.mainRoot);
  return {
    branch: name,
    baseDir,
    path: join(baseDir, name),
    copy: dedup([...ALWAYS_COPY, ...opts.cfg.copy]),
    setup: [...opts.cfg.setup],
  };
}

/**
 * The name a new worktree gets: `<parent>-<name>` when created from inside a
 * worktree, plain `<name>` from the main checkout. Used for both the branch and
 * the directory basename — several call sites (`goto`'s basename fallback,
 * `worktreePathForBranch`) assume the two match.
 *
 * Already-prefixed input is left alone, so `create dev-x` and `create x` from
 * `dev` both land on `dev-x` — re-running after a failed create is idempotent.
 */
export function derivedWorktreeName(parent: string, name: string): string {
  const raw = name.trim();
  const from = parent.trim();
  if (!from) return raw;
  return raw === from || raw.startsWith(`${from}-`) ? raw : `${from}-${raw}`;
}

function resolveBaseDir(dir: string, mainRoot: string): string {
  if (dir) return isAbsolute(dir) ? dir : resolve(mainRoot, dir);
  // Grouped-sibling default: <parent>/<repo>-worktrees.
  return join(dirname(mainRoot), `${basename(mainRoot)}-worktrees`);
}

/**
 * The next PROJECT_PORT to assign to a new worktree. Never below `base` (the
 * `project.port` starting point); otherwise one past the highest port already
 * assigned to an existing worktree, so ports only ever climb. Pure — the caller
 * gathers `existing` from the other worktrees' stamped local configs.
 */
export function nextPort(base: number, existing: readonly number[]): number {
  const start = base > 0 ? base : 0;
  if (existing.length === 0) return start;
  const highest = existing.reduce((max, p) => (p > max ? p : max), 0);
  return Math.max(start, highest + 1);
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
