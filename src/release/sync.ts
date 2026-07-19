import { basename } from "node:path";

import { parseDocument } from "yaml";

/**
 * Version mirroring for `claudjar release`.
 *
 * `project.dist.version` in `.jarrin.yml` is the source of truth; every path in
 * `project.dist.sync` is a file that carries the same number somewhere else and
 * has to be rewritten in step. Which "somewhere else" that is depends entirely on
 * the file, so this module dispatches on the filename to a small set of handlers
 * and rewrites **in place, preserving formatting** — a release must not reformat
 * a manifest as a side effect.
 *
 * Adding a format means adding one handler here and one test; nothing else in the
 * release flow knows about file types.
 */

/** The environment key written into `.env`-family files. */
export const ENV_VERSION_KEY = "APP_VERSION";

/** What happened to one synced file. */
export type SyncStatus =
  /** The version field was found and rewritten. */
  | "updated"
  /** The field was found and already held this version. */
  | "unchanged"
  /** The file type is known but carries no version field to update. */
  | "no-field"
  /** No handler matches this filename. */
  | "unsupported";

export interface SyncResult {
  readonly status: SyncStatus;
  /** Rewritten content; identical to the input unless `status === "updated"`. */
  readonly text: string;
  /** Handler that claimed the file, for reporting ("json", "env", …). */
  readonly kind: string;
}

/**
 * Rewrite the version carried by `text`, choosing a handler from `filePath`'s
 * name. Pure: the caller owns reading and writing the file, which keeps every
 * format testable as a string transform.
 */
export function syncVersion(
  filePath: string,
  text: string,
  version: string,
): SyncResult {
  const name = basename(filePath);
  const lower = name.toLowerCase();

  if (lower.endsWith(".json")) return syncJson(text, version);
  if (lower === ".env" || lower.startsWith(".env.")) {
    return syncEnv(text, version);
  }
  if (lower.endsWith(".toml")) return syncToml(text, version);
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
    return syncYaml(text, version);
  }
  return { status: "unsupported", text, kind: "unknown" };
}

/**
 * JSON manifests (package.json, composer.json, …): rewrite the **top-level**
 * `"version"` string.
 *
 * Done as a targeted text replacement rather than parse-mutate-stringify so key
 * order, indentation, and trailing newline survive untouched. The top-level key
 * is located by walking the raw text with a depth counter, which is what stops a
 * nested `"version"` (inside `dependencies`, `engines`, an npm `overrides` block)
 * from being hit instead.
 */
function syncJson(text: string, version: string): SyncResult {
  const span = findTopLevelJsonVersion(text);
  if (!span) return { status: "no-field", text, kind: "json" };
  if (span.value === version)
    return { status: "unchanged", text, kind: "json" };
  const next =
    text.slice(0, span.start) +
    escapeJsonString(version) +
    text.slice(span.end);
  return { status: "updated", text: next, kind: "json" };
}

interface Span {
  /** Offset of the first character inside the value's quotes. */
  readonly start: number;
  /** Offset just past the last character inside the value's quotes. */
  readonly end: number;
  readonly value: string;
}

/**
 * Locate the value span of the top-level `"version"` key in a JSON document.
 *
 * A hand-rolled scan rather than a regex: it tracks brace/bracket depth and skips
 * over string literals (respecting backslash escapes) so that a `"version"`
 * appearing at any nested depth, or inside another string's contents, is not
 * mistaken for the manifest's own.
 */
function findTopLevelJsonVersion(text: string): Span | null {
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const key = readJsonString(text, i);
      if (!key) return null;
      // A key at depth 1 is a direct member of the root object.
      if (depth === 1 && key.value === "version") {
        const colon = skipToColon(text, key.end);
        if (colon === -1) return null;
        const valueStart = skipWhitespace(text, colon + 1);
        if (text[valueStart] !== '"') return null;
        const value = readJsonString(text, valueStart);
        if (!value) return null;
        return {
          start: valueStart + 1,
          end: value.end - 1,
          value: value.value,
        };
      }
      i = key.end;
      continue;
    }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
    i++;
  }
  return null;
}

interface StringToken {
  /** Decoded contents, without the surrounding quotes. */
  readonly value: string;
  /** Offset just past the closing quote. */
  readonly end: number;
}

/** Read the JSON string starting at `start` (which must be a `"`). */
function readJsonString(text: string, start: number): StringToken | null {
  let i = start + 1;
  let value = "";
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      value += text.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '"') return { value, end: i + 1 };
    value += ch;
    i++;
  }
  return null;
}

function skipWhitespace(text: string, from: number): number {
  let i = from;
  while (i < text.length && /\s/.test(text[i] ?? "")) i++;
  return i;
}

function skipToColon(text: string, from: number): number {
  const i = skipWhitespace(text, from);
  return text[i] === ":" ? i : -1;
}

function escapeJsonString(value: string): string {
  // Versions are alphanumerics and dots, but escape defensively so a bad value
  // can never break out of the string literal it is written into.
  return JSON.stringify(value).slice(1, -1);
}

/**
 * `.env`-family files: set `APP_VERSION=<version>`, updating the existing
 * assignment in place (keeping its position and any `export ` prefix) or
 * appending one when absent.
 */
function syncEnv(text: string, version: string): SyncResult {
  const lines = text.split("\n");
  const pattern = new RegExp(`^(\\s*(?:export\\s+)?${ENV_VERSION_KEY}\\s*=)`);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = pattern.exec(line);
    if (!m) continue;
    const next = `${m[1] ?? ""}${version}`;
    if (next === line) return { status: "unchanged", text, kind: "env" };
    lines[i] = next;
    return { status: "updated", text: lines.join("\n"), kind: "env" };
  }
  // Absent: append, keeping exactly one trailing newline.
  const body = text.replace(/\n+$/, "");
  const prefix = body === "" ? "" : `${body}\n`;
  return {
    status: "updated",
    text: `${prefix}${ENV_VERSION_KEY}=${version}\n`,
    kind: "env",
  };
}

/**
 * TOML manifests (pyproject.toml, Cargo.toml): rewrite `version = "…"` inside
 * the table that owns the project's own version — `[project]` for PEP 621 and
 * Cargo, `[tool.poetry]` for Poetry's legacy layout.
 *
 * Scoping to those tables is the whole point: a bare "first version key" search
 * would happily rewrite a pinned dependency's version in `[tool.poetry.dependencies]`.
 */
function syncToml(text: string, version: string): SyncResult {
  const OWNING_TABLES = ["project", "tool.poetry", "package"];
  const lines = text.split("\n");
  let table = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (header) {
      table = (header[1] ?? "").trim();
      continue;
    }
    if (!OWNING_TABLES.includes(table)) continue;
    const m = /^(\s*version\s*=\s*")([^"]*)(".*)$/.exec(line);
    if (!m) continue;
    if (m[2] === version) return { status: "unchanged", text, kind: "toml" };
    lines[i] = `${m[1] ?? ""}${version}${m[3] ?? ""}`;
    return { status: "updated", text: lines.join("\n"), kind: "toml" };
  }
  return { status: "no-field", text, kind: "toml" };
}

/**
 * YAML files: set the top-level `version:` key, preserving comments and every
 * other node (the same comment-preserving Document write the config writer uses).
 * Only an existing key is updated — a YAML file with no `version` is reported
 * rather than grown a new key, since where it would belong is unknowable.
 */
function syncYaml(text: string, version: string): SyncResult {
  const doc = parseDocument(text);
  if (doc.errors.length > 0 || !doc.has("version")) {
    return { status: "no-field", text, kind: "yaml" };
  }
  if (String(doc.get("version")).trim() === version) {
    return { status: "unchanged", text, kind: "yaml" };
  }
  doc.set("version", version);
  return { status: "updated", text: doc.toString(), kind: "yaml" };
}
