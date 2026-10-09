import type { LogDetail, LogLine } from "#shared/protocol";
import { isProse, parseJson, type JsonValue } from "./json";
import { fence } from "./markdown";

/** A file a Bash call writes to, followed live while the command runs. */
export interface LiveTail {
  readonly file: string;
  readonly text: string;
  readonly done: boolean;
}

/** One row of the log: a line, plus — for a tool call — the result answering it. */
export interface LogItem {
  readonly line: LogLine;
  readonly result?: LogLine;
  readonly tail?: LiveTail;
}

/** How much of a tail is kept: the end of a long build log is what matters. */
export const MAX_TAIL_CHARS = 256 * 1024;

/**
 * Fold each tool result into the tool call it answers (paired by tool_use id),
 * and each `tail` line into the live output of the call that writes it.
 */
export function groupLines(lines: readonly LogLine[]): LogItem[] {
  const items: LogItem[] = [];
  const pending = new Map<string, number>();
  const calls = new Map<string, number>();
  for (const line of lines) {
    const call = line.call;
    if (line.kind === "tool" && call) {
      pending.set(call, items.length);
      calls.set(call, items.length);
      items.push({ line });
      continue;
    }
    if (line.kind === "tail") {
      const at = call ? calls.get(call) : undefined;
      const item = at === undefined ? undefined : items[at];
      if (at !== undefined && item && line.detail?.type === "tail") {
        const text = (item.tail?.text ?? "") + line.text;
        items[at] = {
          ...item,
          tail: {
            file: line.detail.file,
            text:
              text.length > MAX_TAIL_CHARS
                ? text.slice(text.length - MAX_TAIL_CHARS)
                : text,
            done: line.detail.done,
          },
        };
      }
      // A tail whose call scrolled out of the log has nothing to attach to.
      continue;
    }
    const at =
      (line.kind === "output" || line.kind === "error") && call
        ? pending.get(call)
        : undefined;
    const item = at === undefined ? undefined : items[at];
    if (at !== undefined && item && call) {
      items[at] = { ...item, result: line };
      pending.delete(call);
      continue;
    }
    items.push({ line });
  }
  return items;
}

/** Split a tool line's text (`→ Name  summary`) into its parts. */
export function splitTool(text: string): { name: string; summary: string } {
  const body = text.replace(/^→\s*/, "");
  const gap = body.indexOf("  ");
  return gap < 0
    ? { name: body, summary: "" }
    : { name: body.slice(0, gap), summary: body.slice(gap + 2) };
}

const TOOL_ICONS: Readonly<Record<string, string>> = {
  Bash: "i-lucide-terminal",
  Read: "i-lucide-file-text",
  Edit: "i-lucide-file-pen",
  Write: "i-lucide-file-plus",
  Grep: "i-lucide-search",
  Glob: "i-lucide-folder-search",
  WebFetch: "i-lucide-globe",
  WebSearch: "i-lucide-globe",
  Agent: "i-lucide-bot",
  Task: "i-lucide-bot",
  Skill: "i-lucide-sparkles",
  TodoWrite: "i-lucide-list-checks",
};

export function toolIcon(name: string): string {
  if (name.startsWith("mcp__")) return "i-lucide-plug";
  return TOOL_ICONS[name] ?? "i-lucide-wrench";
}

/** A patch as unified-diff text, for a ```diff block. */
export function patchText(
  detail: Extract<LogDetail, { type: "patch" }>,
): string {
  const body = detail.hunks
    .map(
      (h) =>
        `@@ -${String(h.oldStart)} +${String(h.newStart)} @@\n${h.lines.join("\n")}`,
    )
    .join("\n");
  return detail.omitted > 0
    ? `${body}\n… ${String(detail.omitted)} more lines`
    : body;
}

export function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Input keys whose (multi-line) string value is code, and its language. */
const CODE_KEYS: Readonly<Record<string, string>> = {
  command: "bash",
  script: "bash",
  function: "javascript",
  expression: "javascript",
  code: "javascript",
  js: "javascript",
  sql: "sql",
};

/** A Shiki language for a file, by extension; `text` when unknown. */
const EXT_LANGS: Readonly<Record<string, string>> = {
  ts: "typescript",
  mts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  vue: "vue",
  json: "json",
  md: "markdown",
  py: "python",
  php: "php",
  rs: "rust",
  go: "go",
  sql: "sql",
  sh: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  css: "css",
  html: "html",
};

function langForFile(path: string): string {
  return EXT_LANGS[path.split(".").pop()?.toLowerCase() ?? ""] ?? "text";
}

/**
 * A tool's input as Markdown: the JSON highlighted, with each multi-line string
 * (a script, a query, file content) lifted out into a block of its own language
 * — escaped inside JSON it is unreadable.
 */
export function inputMarkdown(json: string): string {
  const input = parseJson(json);
  if (input === undefined || Array.isArray(input) || input === null)
    return fence("json", json);
  if (typeof input !== "object") return fence("json", json);
  const file = typeof input.file_path === "string" ? input.file_path : "";
  const rest: Record<string, JsonValue> = {};
  const blocks: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.includes("\n")) {
      const lang = CODE_KEYS[key] ?? (file ? langForFile(file) : "text");
      blocks.push(fence(lang, value, `[${key}]`));
    } else rest[key] = value;
  }
  const head =
    Object.keys(rest).length > 0
      ? [fence("json", JSON.stringify(rest, null, 2))]
      : [];
  return [...head, ...blocks].join("\n\n");
}

/**
 * A JSON tool result as a highlighted block; `undefined` when the result is not
 * JSON, or carries prose (an issue body, a page) better read rendered.
 */
export function jsonResultMarkdown(text: string): string | undefined {
  const value = parseJson(text);
  if (value === undefined || hasProse(value)) return undefined;
  return fence("json", JSON.stringify(value, null, 2));
}

function hasProse(value: JsonValue): boolean {
  if (typeof value === "string") return isProse(value);
  if (Array.isArray(value)) return value.some(hasProse);
  if (value !== null && typeof value === "object")
    return Object.values(value).some(hasProse);
  return false;
}

/**
 * Terminal output as plain text: ANSI escapes dropped, and a line rewritten in
 * place with `\r` (a progress bar) reduced to what it last showed.
 */
export function terminalText(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex -- matching escapes is the point
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[()][A-Za-z0-9]|\x1b[=>]/g, "")
      .split("\n")
      .map((l) => {
        const parts = l.replace(/\r+$/, "").split("\r");
        return parts[parts.length - 1] ?? "";
      })
      .join("\n")
  );
}
