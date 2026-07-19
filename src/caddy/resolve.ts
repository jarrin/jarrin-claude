import type { JarrinConfig } from "../config/schema.js";
import type { CaddyEntry } from "./route.js";
import { hostsFor, toLabel, upstreamFor } from "./route.js";

/**
 * What a repo (or one of its worktrees) registers as, derived from its merged
 * config. Pure — the caller supplies the config and the root path.
 */
export interface CaddyTarget {
  readonly entry: CaddyEntry;
  /** The hostnames this entry will claim, for reporting back to the user. */
  readonly hosts: string[];
  /** Whether `caddy.enabled` is set. Resolution does not depend on it. */
  readonly enabled: boolean;
}

/**
 * Resolve the current checkout's caddy identity, or null when it has no
 * `project.slug` — without a slug there is no domain to route, so there is
 * nothing to register under.
 *
 * The worktree segment is `worktree.slug` when set, else the stamped
 * `worktree.name`; a main checkout has neither and sits at the root of the
 * project's domain.
 *
 * `enabled` is reported rather than enforced because the two callers want
 * opposite things from it: `join` refuses when the repo has not opted in, while
 * `leave` must still be able to deregister a repo that just opted out.
 */
export function resolveTarget(
  cfg: JarrinConfig,
  root: string,
): CaddyTarget | null {
  const slug = toLabel(cfg.project.slug);
  if (!slug) return null;
  const worktree = toLabel(cfg.worktree.slug || cfg.worktree.name);
  return {
    entry: { slug, worktree, upstream: upstreamFor(slug, worktree), root },
    hosts: hostsFor(slug, worktree),
    enabled: cfg.caddy.enabled,
  };
}
