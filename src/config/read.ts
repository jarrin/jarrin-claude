import { parse } from "yaml";

import type {
  CaddyConfig,
  CommandRow,
  HooksConfig,
  ImportRule,
  JarrinConfig,
  ProjectConfig,
  WorktreeConfig,
} from "./schema.js";
import {
  emptyCaddyConfig,
  emptyConfig,
  emptyHooksConfig,
  emptyProjectConfig,
  emptyWorktreeConfig,
} from "./schema.js";

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
  cfg.project = toProject(map.project);
  cfg.worktree = toWorktree(map.worktree);
  cfg.hooks = toHooks(map.hooks);
  cfg.caddy = toCaddy(map.caddy);
  return cfg;
}

/**
 * Report why a config file failed to parse, or null when it is valid YAML.
 *
 * {@link parseConfig} deliberately swallows parse errors so a broken file cannot
 * crash a session — but silence has its own cost: a config with, say, an
 * unquoted `desc:` containing a colon degrades to *nothing selected*, and looks
 * identical to a repo that simply opted out. Callers that can afford to talk
 * (the hook's stderr, `claudjar info`) use this to say so out loud.
 */
export function configParseError(text: string): string | null {
  try {
    parse(text);
    return null;
  } catch (e) {
    return e instanceof Error
      ? (e.message.split("\n")[0] ?? "invalid YAML")
      : "invalid YAML";
  }
}

function toProject(value: unknown): ProjectConfig {
  const project = emptyProjectConfig();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return project;
  }
  const rec = value as Record<string, unknown>;
  project.slug = toSlug(rec.slug);
  project.port = toPort(rec.port);
  const commands = rec.commands;
  if (commands !== null && typeof commands === "object") {
    const cmd = commands as Record<string, unknown>;
    project.commands.start =
      typeof cmd.start === "string" ? cmd.start.trim() : "";
    project.commands.exit = typeof cmd.exit === "string" ? cmd.exit.trim() : "";
    project.commands.build =
      typeof cmd.build === "string" ? cmd.build.trim() : "";
  }
  const dist = rec.dist;
  if (dist !== null && typeof dist === "object" && !Array.isArray(dist)) {
    const d = dist as Record<string, unknown>;
    project.dist.version = toVersionString(d.version);
    project.dist.sync = toStringList(d.sync);
  }
  return project;
}

function toHooks(value: unknown): HooksConfig {
  const hooks = emptyHooksConfig();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return hooks;
  }
  const wt = (value as Record<string, unknown>).worktree;
  if (wt === null || typeof wt !== "object" || Array.isArray(wt)) {
    return hooks;
  }
  const rec = wt as Record<string, unknown>;
  hooks.worktree.create = toStringList(rec.create);
  hooks.worktree.remove = toStringList(rec.remove);
  return hooks;
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
  wt.port = toPort(rec.port);
  wt.slug = toSlug(rec.slug);
  return wt;
}

function toCaddy(value: unknown): CaddyConfig {
  const caddy = emptyCaddyConfig();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return caddy;
  }
  caddy.enabled = (value as Record<string, unknown>).enabled === true;
  return caddy;
}

/**
 * Coerce a YAML scalar to a slug. Numbers are accepted for the same reason
 * {@link toVersionString} accepts them — `slug: 2048` is a plausible project
 * name that YAML hands over as a number. Structural values yield "".
 */
function toSlug(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

/**
 * Coerce a YAML scalar to a version string.
 *
 * Only scalars are accepted, because a version is one. The number case is not
 * hypothetical: `version: 1.2` is valid YAML float syntax and arrives here as a
 * number, while `1.2.3` (two dots) parses as a string. Anything structural —
 * a map or list under `version:` — is a config error and yields "" rather than
 * a stringified `[object Object]`.
 */
function toVersionString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

/** Coerce a YAML scalar to a non-negative integer port; anything else → 0. */
function toPort(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
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
