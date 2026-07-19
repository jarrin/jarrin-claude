import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parse, stringify } from "yaml";

import type { CaddyEntry } from "./route.js";
import { entryKey, renderCaddyfile, sortEntries, toLabel } from "./route.js";

/**
 * The machine-wide registry of caddy routes: which projects and worktrees exist,
 * and what claudjar's caddy should proxy each of them to.
 *
 * It lives outside every repo (`~/.claudjar/caddy/`) because it is inherently
 * cross-repo — the generated Caddyfile has to name projects the current working
 * directory knows nothing about. A repo contributes to it only by running
 * `claudjar caddy join`, which reads that repo's `.jarrin.yml` and writes one
 * entry; the Caddyfile is then regenerated from the whole registry.
 *
 * The registry is the source of truth and the Caddyfile is derived. Nothing ever
 * parses the Caddyfile back, so hand-edits to it are lost on the next join — the
 * generated header says so.
 */

export const REGISTRY_FILE = "registry.yml";
export const CADDYFILE = "Caddyfile";

const HEADER = [
  "# claudjar caddy registry — written by `claudjar caddy join | leave`.",
  "# The Caddyfile beside it is generated from this; edit here, not there.",
  "",
].join("\n");

/**
 * Parse the registry. Like {@link parseConfig} this never throws: a corrupt
 * registry degrades to "nothing registered", which regenerates an empty (but
 * valid) Caddyfile rather than wedging every caddy command on the machine.
 */
export function parseRegistry(text: string): CaddyEntry[] {
  let doc: unknown;
  try {
    doc = parse(text);
  } catch {
    return [];
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return [];
  const raw = (doc as Record<string, unknown>).entries;
  if (!Array.isArray(raw)) return [];

  const out: CaddyEntry[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const slug = str(rec.slug);
    if (!slug) continue;
    const worktree = str(rec.worktree);
    out.push({
      slug,
      worktree,
      // A registry written by an older claudjar may predate a field; deriving
      // the upstream keeps such an entry routable instead of silently dropping
      // it into a `reverse_proxy :8000` with no host.
      upstream: str(rec.upstream) || `caddy-${toLabel(slug)}`,
      root: str(rec.root),
    });
  }
  return out;
}

export function serializeRegistry(entries: readonly CaddyEntry[]): string {
  return HEADER + stringify({ entries: sortEntries(entries) });
}

export function registryPath(dir: string): string {
  return join(dir, REGISTRY_FILE);
}

export function caddyfilePath(dir: string): string {
  return join(dir, CADDYFILE);
}

/** Read the registry from `dir`; a missing file is an empty registry, not an error. */
export function readRegistry(dir: string): CaddyEntry[] {
  const path = registryPath(dir);
  if (!existsSync(path)) return [];
  try {
    return parseRegistry(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
}

/**
 * Write the registry and regenerate the Caddyfile beside it, in that order —
 * the derived file is never newer than the source it came from.
 */
export function writeRegistry(
  dir: string,
  entries: readonly CaddyEntry[],
): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(registryPath(dir), serializeRegistry(entries), "utf8");
  writeFileSync(caddyfilePath(dir), renderCaddyfile(entries), "utf8");
}

/** Add `entry`, replacing any existing route for the same project + worktree. */
export function upsertEntry(
  entries: readonly CaddyEntry[],
  entry: CaddyEntry,
): CaddyEntry[] {
  const key = entryKey(entry);
  const out = entries.filter((e) => entryKey(e) !== key);
  out.push(entry);
  return sortEntries(out);
}

/** Drop the route for a project + worktree; absent is not an error. */
export function removeEntry(
  entries: readonly CaddyEntry[],
  slug: string,
  worktree: string,
): CaddyEntry[] {
  const key = entryKey({ slug, worktree });
  return entries.filter((e) => entryKey(e) !== key);
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}
