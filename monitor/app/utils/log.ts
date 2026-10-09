import type { LogDetail, LogLine } from "#shared/protocol";

/** One row of the log: a line, plus — for a tool call — the result answering it. */
export interface LogItem {
  readonly line: LogLine;
  readonly result?: LogLine;
}

/** Fold each tool result into the tool call it answers (paired by tool_use id). */
export function groupLines(lines: readonly LogLine[]): LogItem[] {
  const items: LogItem[] = [];
  const pending = new Map<string, number>();
  for (const line of lines) {
    const call = line.call;
    if (line.kind === "tool" && call) {
      pending.set(call, items.length);
      items.push({ line });
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
