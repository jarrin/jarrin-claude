import { parseDocument, YAMLMap } from "yaml";

/**
 * Set `worktree.name: <name>` in a `.jarrin.local.yml` document, preserving every
 * other key and its comments. This is the identity marker `worktree create`
 * writes into a new worktree's copied local config so the `todo` /
 * `staged-planning` skills can scope forge work to the worktree.
 *
 * `existing` may be empty (a brand-new file) — the block is created as needed.
 */
export function stampWorktreeName(existing: string, name: string): string {
  const doc = parseDocument(existing.trim() ? existing : "");
  let wt = doc.get("worktree");
  if (!(wt instanceof YAMLMap)) {
    wt = new YAMLMap();
    doc.set("worktree", wt);
  }
  (wt as YAMLMap).set("name", name);
  return doc.toString();
}
