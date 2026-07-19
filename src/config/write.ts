import { Document, parseDocument, YAMLMap, YAMLSeq } from "yaml";

import type { JarrinConfig } from "./schema.js";

/**
 * Set `project.dist.version` in a `.jarrin.yml` document, preserving every other
 * key, its comments, and the surrounding block structure. This is how
 * `claudjar release` writes the bumped version back to the source of truth —
 * the same comment-preserving approach {@link serializeConfig} takes for the
 * tiers, and `stampWorktree` takes for a worktree's identity.
 *
 * Missing `project:` / `project.dist:` blocks are created as needed, so a repo
 * can be released without hand-authoring the block first.
 */
export function stampDistVersion(existing: string, version: string): string {
  const doc = parseDocument(existing.trim() ? existing : "");
  const project = ensureMap(doc.get("project"), (m) => doc.set("project", m));
  const dist = ensureMap(project.get("dist"), (m) => project.set("dist", m));
  // Emitted unquoted; a three-segment version is not valid YAML number syntax,
  // so it round-trips as a string (and the reader String()s it regardless).
  dist.set("version", version);
  return doc.toString();
}

function ensureMap(current: unknown, attach: (map: YAMLMap) => void): YAMLMap {
  if (current instanceof YAMLMap) return current;
  const map = new YAMLMap();
  attach(map);
  return map;
}

/**
 * Serialise a {@link JarrinConfig} to `.jarrin.yml` text.
 *
 * When `existing` is provided, its YAML is parsed to a Document and only the
 * hook-consumed keys are replaced — every other node (comments, key order, and
 * crucially the skill-owned `backlog:` block) is preserved. When it is absent, a
 * fresh commented template is emitted.
 */
export function serializeConfig(cfg: JarrinConfig, existing?: string): string {
  if (existing !== undefined && existing.trim() !== "") {
    return updateDocument(cfg, existing);
  }
  return renderTemplate(cfg);
}

function updateDocument(cfg: JarrinConfig, existing: string): string {
  const doc = parseDocument(existing);
  applyTier(doc, "rules", cfg.rules);
  applyTier(doc, "local", cfg.local);
  applyTier(
    doc,
    "imports",
    cfg.imports.map((i) => ({ owner: i.owner, rule: i.rule })),
  );
  applyTier(
    doc,
    "commands",
    cfg.commands.map((c) => ({ cmd: c.cmd, desc: c.desc })),
  );
  if (cfg.backup) {
    doc.set("backup", cfg.backup);
  } else {
    doc.delete("backup");
  }
  return doc.toString();
}

function applyTier(
  doc: Document,
  key: string,
  items: readonly unknown[],
): void {
  if (items.length === 0) {
    doc.delete(key);
    return;
  }
  const seq = new YAMLSeq();
  for (const item of items) seq.add(item);
  doc.set(key, seq);
}

function renderTemplate(cfg: JarrinConfig): string {
  const lines: string[] = [
    "# Jarrin project rules — selected per repo, injected by the SessionStart",
    "# hook. All keys are optional; an empty file injects nothing. See the",
    "# jarrin-claude repo CLAUDE.md for the full schema.",
    "",
  ];

  if (cfg.rules.length > 0) {
    lines.push("# Tier a — global rule slugs → ~/.claude/rules/<slug>.md");
    lines.push("rules:");
    for (const r of cfg.rules) lines.push(`  - ${r}`);
  } else {
    lines.push(
      "# rules:            # global rule slugs → ~/.claude/rules/<slug>.md",
    );
    lines.push("#   - lang-ts");
  }
  lines.push("");

  if (cfg.local.length > 0) {
    lines.push("# Tier b — in-repo rule files (paths from the repo root)");
    lines.push("local:");
    for (const l of cfg.local) lines.push(`  - ${l}`);
    lines.push("");
  }

  if (cfg.imports.length > 0) {
    lines.push("# Tier c — cross-repo imports (owner repo + a rule it owns)");
    lines.push("imports:");
    for (const i of cfg.imports) {
      lines.push(`  - owner: ${i.owner}`);
      lines.push(`    rule: ${i.rule}`);
    }
    lines.push("");
  }

  if (cfg.commands.length > 0) {
    lines.push("# Dev-command quick reference (rendered as a table)");
    lines.push("commands:");
    for (const c of cfg.commands) {
      lines.push(`  - cmd: ${quoteIfNeeded(c.cmd)}`);
      lines.push(`    desc: ${quoteIfNeeded(c.desc)}`);
    }
    lines.push("");
  }

  if (cfg.backup) {
    lines.push(
      "# Shell command run before a new session / clear (fatal on failure)",
    );
    lines.push(`backup: ${quoteIfNeeded(cfg.backup)}`);
    lines.push("");
  }

  // The project: stack block is hand-authored (like worktree:/backlog:), so the
  // template only shows a commented example rather than emitting a live block.
  lines.push(
    "# Per-worktree runtime stack. `port` is the starting port worktrees increment",
    "# from; the start/exit commands run with PROJECT_PORT set, on session start and",
    "# exit inside a worktree (the main checkout is never affected).",
    "# project:",
    "#   port: 8000",
    "#   commands:",
    "#     start: docker compose up -d",
    "#     exit: docker compose down",
    "",
  );

  return lines.join("\n").replace(/\n+$/, "\n");
}

function quoteIfNeeded(value: string): string {
  // Reuse the yaml serialiser for a single scalar so special characters
  // (colons, quotes, leading indicators) are escaped correctly.
  const doc = new Document(value);
  return doc.toString().trim();
}
