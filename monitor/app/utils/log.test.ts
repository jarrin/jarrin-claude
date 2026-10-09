import { describe, expect, it } from "vitest";
import type { LogLine } from "#shared/protocol";
import {
  groupLines,
  inputMarkdown,
  jsonResultMarkdown,
  patchText,
  splitTool,
  toolIcon,
} from "./log";

const at = (kind: LogLine["kind"], text: string, call?: string): LogLine =>
  call ? { t: 0, kind, text, call } : { t: 0, kind, text };

describe("groupLines", () => {
  it("folds each result into its own call, even out of order", () => {
    const items = groupLines([
      at("tool", "→ Read  a", "1"),
      at("tool", "→ Read  b", "2"),
      at("output", "B", "2"),
      at("text", "hi"),
      at("error", "A failed", "1"),
    ]);
    expect(items.map((i) => [i.line.text, i.result?.text])).toEqual([
      ["→ Read  a", "A failed"],
      ["→ Read  b", "B"],
      ["hi", undefined],
    ]);
  });

  it("keeps unpaired results (older lines without ids) as their own rows", () => {
    const items = groupLines([at("tool", "→ Bash  ls"), at("output", "x")]);
    expect(items).toHaveLength(2);
  });
});

describe("splitTool", () => {
  it("separates the tool name from its summary", () => {
    expect(splitTool("→ Bash  git status  -s")).toEqual({
      name: "Bash",
      summary: "git status  -s",
    });
    expect(splitTool("→ TodoWrite")).toEqual({
      name: "TodoWrite",
      summary: "",
    });
  });
});

describe("toolIcon", () => {
  it("maps known tools, MCP tools and the rest", () => {
    expect(toolIcon("Bash")).toBe("i-lucide-terminal");
    expect(toolIcon("mcp__gitea__issue_read")).toBe("i-lucide-plug");
    expect(toolIcon("Whatever")).toBe("i-lucide-wrench");
  });
});

describe("patchText", () => {
  it("renders hunks as unified diff text", () => {
    expect(
      patchText({
        type: "patch",
        file: "/f",
        hunks: [{ oldStart: 1, newStart: 1, lines: [" a", "-b", "+B"] }],
        omitted: 2,
      }),
    ).toBe("@@ -1 +1 @@\n a\n-b\n+B\n… 2 more lines");
  });
});

describe("inputMarkdown", () => {
  it("highlights the JSON and lifts multi-line code into its own block", () => {
    const md = inputMarkdown(
      JSON.stringify({ pageId: 1, function: "() => {\n  return 1;\n}" }),
    );
    expect(md).toBe(
      '```json\n{\n  "pageId": 1\n}\n```\n\n' +
        "```javascript [function]\n() => {\n  return 1;\n}\n```",
    );
  });

  it("picks a file's language for its multi-line content", () => {
    expect(
      inputMarkdown(JSON.stringify({ file_path: "a.py", content: "x\ny" })),
    ).toContain("```python [content]\nx\ny\n```");
  });
});

describe("jsonResultMarkdown", () => {
  it("pretty-prints data, but leaves prose to the tree", () => {
    expect(jsonResultMarkdown('{"a":[1,2]}')).toBe(
      "```json\n" + JSON.stringify({ a: [1, 2] }, null, 2) + "\n```",
    );
    expect(jsonResultMarkdown('{"body":"line\\nline"}')).toBeUndefined();
    expect(jsonResultMarkdown("plain text")).toBeUndefined();
  });
});
