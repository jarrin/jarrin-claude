import type { LogLine } from "#shared/protocol";
import { parseJson, type JsonValue } from "./json";
import { splitTool } from "./log";

/**
 * Which component renders a tool call. Built-in tools are keyed by kind; MCP
 * tools by `mcp/<server>/<resource>/<verb>`, falling back to the server's own
 * component, then to the generic MCP one.
 */
export type ToolRoute =
  | "bash"
  | "file"
  | "search"
  | "skill"
  | "tool-search"
  | "agent"
  | "web"
  | "todo"
  | "mcp/gitea/milestone/read"
  | "mcp/gitea/milestone/write"
  | "mcp/gitea/issue/read"
  | "mcp/gitea/issue/write"
  | "mcp/gitea/issue/list"
  | "mcp/gitea"
  | "mcp"
  | "default";

const BUILTIN: Readonly<Record<string, ToolRoute>> = {
  Bash: "bash",
  Read: "file",
  Edit: "file",
  Write: "file",
  NotebookEdit: "file",
  Grep: "search",
  Glob: "search",
  Skill: "skill",
  ToolSearch: "tool-search",
  Agent: "agent",
  Task: "agent",
  WebFetch: "web",
  WebSearch: "web",
  TodoWrite: "todo",
};

const GITEA: Readonly<Record<string, ToolRoute>> = {
  milestone_read: "mcp/gitea/milestone/read",
  milestone_write: "mcp/gitea/milestone/write",
  issue_read: "mcp/gitea/issue/read",
  issue_write: "mcp/gitea/issue/write",
  list_issues: "mcp/gitea/issue/list",
  search_issues: "mcp/gitea/issue/list",
};

/** `mcp__server__tool` → its parts; `undefined` for a built-in tool. */
export function mcpName(
  name: string,
): { server: string; tool: string } | undefined {
  const parts = name.split("__");
  if (parts[0] !== "mcp" || parts.length < 3) return undefined;
  return { server: parts[1] ?? "", tool: parts.slice(2).join("__") };
}

export function routeTool(name: string): ToolRoute {
  const mcp = mcpName(name);
  if (!mcp) return BUILTIN[name] ?? "default";
  if (mcp.server === "gitea") return GITEA[mcp.tool] ?? "mcp/gitea";
  return "mcp";
}

/** A tool call's name and its input, decoded. */
export interface ToolCall {
  readonly name: string;
  /** The loop's one-line summary of the input. */
  readonly summary: string;
  readonly input: Readonly<Record<string, JsonValue>>;
}

export function toolCall(line: LogLine): ToolCall {
  const { name, summary } = splitTool(line.text);
  const d = line.detail;
  let input: Record<string, JsonValue> = {};
  if (d?.type === "command") input = { command: d.command };
  else if (d?.type === "input") {
    const parsed = parseJson(d.json);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed))
      input = parsed;
  }
  return { name, summary, input };
}

/** A string input field; `""` when absent or not a string. */
export function str(
  input: Readonly<Record<string, JsonValue>>,
  key: string,
): string {
  const v = input[key];
  return typeof v === "string" ? v : "";
}

/** A numeric input field (numbers may arrive as strings); `undefined` if absent. */
export function num(
  input: Readonly<Record<string, JsonValue>>,
  key: string,
): number | undefined {
  const v = input[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return undefined;
}

/** `milestone_read` / `get-component` → `Milestone read` / `Get component`. */
export function prettyName(name: string): string {
  const words = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const SERVER_NAMES: Readonly<Record<string, string>> = {
  gitea: "Gitea",
  nuxt: "Nuxt",
  "nuxt-ui": "Nuxt UI",
  "claude-in-chrome": "Chrome",
};

export function serverName(server: string): string {
  return SERVER_NAMES[server] ?? prettyName(server.replace(/^claude_ai_/, ""));
}

/** Input keys that best describe a call at a glance, in order of preference. */
const PRIMARY_KEYS = [
  "componentName",
  "path",
  "query",
  "url",
  "name",
  "title",
  "file_path",
  "pattern",
  "description",
];

/** The one input value that says what a call is about; `""` when none does. */
export function primaryArg(input: Readonly<Record<string, JsonValue>>): string {
  for (const key of PRIMARY_KEYS) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return "";
}

/** The tools a `ToolSearch` query selects (`select:a,b`); empty for a search. */
export function selectedTools(query: string): string[] {
  const m = /^select:(.*)$/s.exec(query.trim());
  return m?.[1]
    ? m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

/** `mcp__gitea__issue_read` → `Gitea · Issue read`; built-ins unchanged. */
export function toolLabel(name: string): string {
  const mcp = mcpName(name);
  return mcp ? `${serverName(mcp.server)} · ${prettyName(mcp.tool)}` : name;
}

/** `add_comment` → `Add Comment`: a gitea method as a title. */
export function titleCase(name: string): string {
  return prettyName(name).replace(/\b\w/g, (c) => c.toUpperCase());
}
