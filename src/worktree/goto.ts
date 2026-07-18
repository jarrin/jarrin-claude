/**
 * Pure helpers for `claudjar goto` — turning a worktree name into the path to
 * switch to. No filesystem or git access; the spawn steps live in
 * `commands/goto.ts`.
 */

import { basename } from "node:path";

import { parseWorktreeList, type WorktreeEntry } from "./merge.js";

/** The name that always resolves back to the repo's main checkout. */
export const MAIN_NAME = "main";

/** A resolved destination, or a failure carrying the names that would work. */
export type GotoTarget =
  | { readonly ok: true; readonly path: string; readonly name: string }
  | { readonly ok: false; readonly available: readonly string[] };

/**
 * Resolve `name` to a worktree path. `main` (case-insensitively) is the main
 * checkout — the first record git reports — so you can get back out of a
 * worktree with the same verb you used to leave. Any other name is matched
 * against linked worktrees by branch first, then by directory basename, so both
 * `goto feature/x` and `goto x` reach a worktree created as `feature/x`.
 *
 * Resolution runs against `git worktree list --porcelain` rather than the
 * configured base dir: a worktree moved or added by hand still resolves, and a
 * stale directory that git no longer tracks correctly does not.
 */
export function resolveGotoTarget(
  porcelain: string,
  name: string,
  mainRoot: string,
): GotoTarget {
  const entries = parseWorktreeList(porcelain);
  const wanted = name.trim();
  const linked = entries.slice(1);

  if (wanted.toLowerCase() === MAIN_NAME) {
    // Prefer git's own record of the main worktree; fall back to the caller's
    // resolved root when the porcelain is empty (e.g. git returned nothing).
    return { ok: true, path: entries[0]?.path ?? mainRoot, name: MAIN_NAME };
  }

  const hit =
    linked.find((e) => e.branch === wanted) ??
    linked.find((e) => basename(e.path) === wanted);

  if (!hit) return { ok: false, available: availableNames(linked) };
  return { ok: true, path: hit.path, name: hit.branch ?? basename(hit.path) };
}

/** Names `goto` accepts, for the error message: `main` plus every linked worktree. */
export function availableNames(linked: readonly WorktreeEntry[]): string[] {
  return [MAIN_NAME, ...linked.map((e) => e.branch ?? basename(e.path))];
}
