import { describe, expect, it } from "vitest";
import {
  mcpName,
  prettyName,
  primaryArg,
  routeTool,
  selectedTools,
  titleCase,
  toolCall,
  toolLabel,
} from "./tools";

describe("routeTool", () => {
  it("routes built-in tools by kind", () => {
    expect(routeTool("Bash")).toBe("bash");
    expect(routeTool("Edit")).toBe("file");
    expect(routeTool("ToolSearch")).toBe("tool-search");
    expect(routeTool("Whatever")).toBe("default");
  });
  it("routes gitea tools by resource and verb, then the server", () => {
    expect(routeTool("mcp__gitea__milestone_read")).toBe(
      "mcp/gitea/milestone/read",
    );
    expect(routeTool("mcp__gitea__list_issues")).toBe("mcp/gitea/issue/list");
    expect(routeTool("mcp__gitea__get_me")).toBe("mcp/gitea");
  });
  it("routes any other MCP tool to the generic one", () => {
    expect(routeTool("mcp__nuxt-ui__get-component")).toBe("mcp");
  });
});

describe("mcpName", () => {
  it("splits server and tool, keeping underscores in the server", () => {
    expect(mcpName("mcp__claude_ai_Claude_Docs__batch")).toEqual({
      server: "claude_ai_Claude_Docs",
      tool: "batch",
    });
    expect(mcpName("Bash")).toBeUndefined();
  });
});

describe("toolCall", () => {
  it("decodes a JSON input", () => {
    const call = toolCall({
      t: 0,
      kind: "tool",
      text: "→ Skill  staged-planning",
      detail: {
        type: "input",
        json: '{"skill":"staged-planning","args":"Continue 265"}',
      },
    });
    expect(call).toEqual({
      name: "Skill",
      summary: "staged-planning",
      input: { skill: "staged-planning", args: "Continue 265" },
    });
  });
  it("turns a Bash command detail into a command input", () => {
    expect(
      toolCall({
        t: 0,
        kind: "tool",
        text: "→ Bash  ls",
        detail: { type: "command", command: "ls" },
      }).input,
    ).toEqual({ command: "ls" });
  });
});

describe("names", () => {
  it("prettifies snake, kebab and camel case", () => {
    expect(prettyName("milestone_read")).toBe("Milestone read");
    expect(prettyName("get-component")).toBe("Get component");
    expect(prettyName("listIssues")).toBe("List issues");
    expect(titleCase("add_comment")).toBe("Add Comment");
  });
  it("labels MCP tools by server and tool", () => {
    expect(toolLabel("mcp__gitea__issue_read")).toBe("Gitea · Issue read");
    expect(toolLabel("Bash")).toBe("Bash");
  });
});

describe("selectedTools", () => {
  it("lists a select: query's tools", () => {
    expect(selectedTools("select:a, b,c")).toEqual(["a", "b", "c"]);
    expect(selectedTools("gitea issue")).toEqual([]);
  });
});

describe("primaryArg", () => {
  it("picks the most telling input value", () => {
    expect(primaryArg({ componentName: "Button", full: true })).toBe("Button");
    expect(primaryArg({ full: true })).toBe("");
  });
});
