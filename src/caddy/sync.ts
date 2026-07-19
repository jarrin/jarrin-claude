import { reloadCaddy } from "./docker.js";
import {
  readRegistry,
  removeEntry,
  upsertEntry,
  writeRegistry,
} from "./registry.js";
import type { CaddyEntry } from "./route.js";

/**
 * Registry mutation + Caddyfile regeneration + live reload, as one step.
 *
 * Every caller wants all three or none: a registry entry nobody generated from
 * is invisible, and a Caddyfile the running caddy never re-read is inert. Keeping
 * them together is what lets `join`, `leave`, `worktree create`, `worktree
 * remove`, and `init` all stay one-liners.
 */

export interface SyncResult {
  /** Whether the registry actually changed. */
  readonly changed: boolean;
  /** Whether a reload was issued (false simply means caddy is not running). */
  readonly reloaded: boolean;
  /** Reload failure, if the container was running but refused the new config. */
  readonly error: string | null;
}

export function registerTarget(
  caddyDir: string,
  entry: CaddyEntry,
): SyncResult {
  writeRegistry(caddyDir, upsertEntry(readRegistry(caddyDir), entry));
  return { changed: true, ...reload() };
}

/**
 * Drop a route. Deregistering something that was never registered writes
 * nothing and reloads nothing — worth the check because `worktree remove` calls
 * this unconditionally, and a repo that never used caddy should not have its
 * registry rewritten (nor a running caddy reloaded) on every worktree it retires.
 */
export function deregisterTarget(
  caddyDir: string,
  slug: string,
  worktree: string,
): SyncResult {
  const entries = readRegistry(caddyDir);
  const remaining = removeEntry(entries, slug, worktree);
  if (remaining.length === entries.length) {
    return { changed: false, reloaded: false, error: null };
  }
  writeRegistry(caddyDir, remaining);
  return { changed: true, ...reload() };
}

function reload(): Omit<SyncResult, "changed"> {
  const res = reloadCaddy();
  if (res === null) return { reloaded: false, error: null };
  if (res.status === 0) return { reloaded: true, error: null };
  return {
    reloaded: false,
    error: (res.stderr || res.stdout).trim() || "caddy reload failed",
  };
}
