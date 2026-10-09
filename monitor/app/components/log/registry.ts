import type { Component } from "vue";
import type { LogKind } from "#shared/protocol";
import { splitTool, type LogItem } from "~/utils/log";
import { routeTool, type ToolRoute } from "~/utils/tools";
import NoteLine from "./lines/NoteLine.vue";
import OutputLine from "./lines/OutputLine.vue";
import TextLine from "./lines/TextLine.vue";
import ThinkingLine from "./lines/ThinkingLine.vue";
import AgentTool from "./tools/AgentTool.vue";
import BashTool from "./tools/BashTool.vue";
import DefaultTool from "./tools/DefaultTool.vue";
import FileTool from "./tools/FileTool.vue";
import SearchTool from "./tools/SearchTool.vue";
import SkillTool from "./tools/SkillTool.vue";
import TodoTool from "./tools/TodoTool.vue";
import ToolSearchTool from "./tools/ToolSearchTool.vue";
import WebTool from "./tools/WebTool.vue";
import McpTool from "./tools/mcp/McpTool.vue";
import GiteaTool from "./tools/mcp/gitea/GiteaTool.vue";
import GiteaIssueListTool from "./tools/mcp/gitea/issue/ListTool.vue";
import GiteaIssueReadTool from "./tools/mcp/gitea/issue/ReadTool.vue";
import GiteaIssueWriteTool from "./tools/mcp/gitea/issue/WriteTool.vue";
import GiteaMilestoneReadTool from "./tools/mcp/gitea/milestone/ReadTool.vue";
import GiteaMilestoneWriteTool from "./tools/mcp/gitea/milestone/WriteTool.vue";

/**
 * The component for each tool route. Every one takes `{ item: LogItem }` and
 * renders through `LogRow`; a route with no entry of its own never occurs —
 * `routeTool` falls back to `mcp/gitea`, `mcp` or `default`.
 */
const TOOLS: Readonly<Record<ToolRoute, Component>> = {
  bash: BashTool,
  file: FileTool,
  search: SearchTool,
  skill: SkillTool,
  "tool-search": ToolSearchTool,
  agent: AgentTool,
  web: WebTool,
  todo: TodoTool,
  "mcp/gitea/milestone/read": GiteaMilestoneReadTool,
  "mcp/gitea/milestone/write": GiteaMilestoneWriteTool,
  "mcp/gitea/issue/read": GiteaIssueReadTool,
  "mcp/gitea/issue/write": GiteaIssueWriteTool,
  "mcp/gitea/issue/list": GiteaIssueListTool,
  "mcp/gitea": GiteaTool,
  mcp: McpTool,
  default: DefaultTool,
};

const LINES: Readonly<Record<Exclude<LogKind, "tool">, Component>> = {
  thinking: ThinkingLine,
  text: TextLine,
  result: TextLine,
  output: OutputLine,
  error: OutputLine,
  loop: NoteLine,
  input: NoteLine,
  system: NoteLine,
  // Folded into their call by `groupLines`; never an entry of their own.
  tail: OutputLine,
};

/** The component that renders a log entry. */
export function entryComponent(item: LogItem): Component {
  const line = item.line;
  if (line.kind === "tool") return TOOLS[routeTool(splitTool(line.text).name)];
  return LINES[line.kind];
}
