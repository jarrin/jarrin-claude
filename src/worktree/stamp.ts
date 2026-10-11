import { parseDocument, YAMLMap } from "yaml";

/** Identity stamped into a new worktree's `.jarrin.local.yml` on create. */
export interface WorktreeIdentity {
  readonly name: string;
  /** Assigned PROJECT_PORT for this worktree; omitted/0 leaves the key unset. */
  readonly port: number;
  /** Milestone title the worktree is linked to; omitted/"" removes the key. */
  readonly milestone?: string;
}

/**
 * Set `worktree.name` (and `worktree.port` / `worktree.milestone` when given) in a `.jarrin.local.yml`
 * document, preserving every other key and its comments. This is the identity
 * `worktree create` writes into a new worktree's copied local config so the
 * `todo` / `staged-planning` skills can scope forge work to it, and so the session
 * lifecycle hooks know this worktree's `PROJECT_PORT`.
 *
 * `existing` may be empty (a brand-new file) — the block is created as needed.
 */
export function stampWorktree(
  existing: string,
  identity: WorktreeIdentity,
): string {
  const doc = parseDocument(existing.trim() ? existing : "");
  let wt = doc.get("worktree");
  if (!(wt instanceof YAMLMap)) {
    wt = new YAMLMap();
    doc.set("worktree", wt);
  }
  const map = wt as YAMLMap;
  map.set("name", identity.name);
  if (identity.port > 0) map.set("port", identity.port);
  // A worktree's local file is copied from its source, so an unlinked worktree
  // would otherwise inherit the source's milestone link.
  if (identity.milestone) map.set("milestone", identity.milestone);
  else map.delete("milestone");
  return doc.toString();
}
