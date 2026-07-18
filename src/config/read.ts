import { parse } from "yaml";

import type {
  CommandRow,
  ImportRule,
  JarrinConfig,
  WorktreeConfig,
} from "./schema.js";
import { emptyConfig, emptyWorktreeConfig } from "./schema.js";

/**
 * Parse `.claude/.jarrin.yml` into a typed {@link JarrinConfig}.
 *
 * Unlike the retired Python hook this uses a real YAML parser, so every valid
 * YAML shape (block lists, inline flow lists, mapping lists) is handled by the
 * library. We still only *consume* the four rule/command tiers plus `backup:`
 * and ignore everything else (notably the skill-owned `backlog:` block) — now by
 * choice in code, not because the parser is blind to nesting.
 *
 * Back-compat: a document whose top level is itself a sequence (a bare `- item`
 * list) is treated as `rules`, matching the old loader.
 */
export function parseConfig(text: string): JarrinConfig {
  const cfg = emptyConfig();
  let doc: unknown;
  try {
    doc = parse(text);
  } catch {
    // A malformed file yields an empty config rather than throwing — the hook
    // must degrade, not crash the session.
    return cfg;
  }

  if (Array.isArray(doc)) {
    cfg.rules.push(...toStringList(doc));
    return cfg;
  }
  if (doc === null || typeof doc !== "object") {
    return cfg;
  }

  const map = doc as Record<string, unknown>;
  cfg.rules.push(...toStringList(map.rules));
  cfg.local.push(...toStringList(map.local));
  cfg.imports.push(...toImportList(map.imports));
  cfg.commands.push(...toCommandList(map.commands));
  cfg.backup = typeof map.backup === "string" ? map.backup.trim() : "";
  cfg.worktree = toWorktree(map.worktree);
  return cfg;
}

function toWorktree(value: unknown): WorktreeConfig {
  const wt = emptyWorktreeConfig();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return wt;
  }
  const rec = value as Record<string, unknown>;
  wt.dir = typeof rec.dir === "string" ? rec.dir.trim() : "";
  wt.copy = toStringList(rec.copy);
  // setup commands keep internal spaces but drop blank/whitespace-only entries.
  wt.setup = toStringList(rec.setup);
  wt.name = typeof rec.name === "string" ? rec.name.trim() : "";
  return wt;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) out.push(item.trim());
  }
  return out;
}

function toImportList(value: unknown): ImportRule[] {
  if (!Array.isArray(value)) return [];
  const out: ImportRule[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const owner = typeof rec.owner === "string" ? rec.owner.trim() : "";
    const rule = typeof rec.rule === "string" ? rec.rule.trim() : "";
    if (owner && rule) out.push({ owner, rule });
  }
  return out;
}

function toCommandList(value: unknown): CommandRow[] {
  if (!Array.isArray(value)) return [];
  const out: CommandRow[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const cmd = typeof rec.cmd === "string" ? rec.cmd.trim() : "";
    if (!cmd) continue;
    const desc = typeof rec.desc === "string" ? rec.desc.trim() : "";
    out.push({ cmd, desc });
  }
  return out;
}
