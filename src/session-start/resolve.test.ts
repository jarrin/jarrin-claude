import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyConfig } from "../config/schema.js";
import {
  composePointer,
  composeRulesDocument,
  dedup,
  renderCommands,
  resolveRules,
} from "./resolve.js";

describe("dedup", () => {
  it("preserves order and drops blanks + duplicates", () => {
    expect(dedup(["a", "", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });
});

describe("resolveRules", () => {
  it("resolves the three tiers in load order with the right paths", () => {
    const cfg = emptyConfig();
    cfg.rules.push("lang-ts", "lang-ts");
    cfg.local.push(".claude/rules/local.md");
    cfg.imports.push({ owner: "server", rule: "prdl" });
    cfg.imports.push({ owner: "server", rule: "prdl" }); // duplicate

    const resolved = resolveRules(cfg, "/proj", "/group", "/rules");
    expect(resolved).toEqual([
      { label: "lang-ts", path: join("/rules", "lang-ts.md") },
      {
        label: ".claude/rules/local.md",
        path: join("/proj", ".claude/rules/local.md"),
      },
      {
        label: "server/prdl",
        path: join("/group", "server", ".claude", "rules", "prdl.md"),
      },
    ]);
  });
});

describe("renderCommands", () => {
  it("renders a deduped Markdown table", () => {
    const table = renderCommands([
      { cmd: "pnpm check", desc: "gates" },
      { cmd: "pnpm check", desc: "dup ignored" },
      { cmd: "pnpm dev", desc: "run" },
    ]);
    expect(table).toContain("| `pnpm check` | gates |");
    expect(table).toContain("| `pnpm dev` | run |");
    expect(table).not.toContain("dup ignored");
  });
});

describe("composeRulesDocument", () => {
  it("returns null when only the header would be present", () => {
    expect(composeRulesDocument({ ruleBlocks: [] })).toBeNull();
  });

  it("joins commands, rules and extra md with the header", () => {
    const out = composeRulesDocument({
      commandsTable: "## Commands",
      ruleBlocks: ["RULE A", "RULE B"],
      extraMd: "PROJECT MD",
    });
    expect(out).not.toBeNull();
    expect(out).toContain("# Jarrin project rules");
    expect(out).toContain("## Commands");
    expect(out).toContain("RULE A\n\n---\n\nRULE B");
    expect(out).toContain("PROJECT MD");
    expect(out?.endsWith("\n")).toBe(true);
  });

  it("excludes the per-session stack status, so the file is stable", () => {
    const first = composeRulesDocument({ ruleBlocks: ["RULE A"] });
    const second = composeRulesDocument({ ruleBlocks: ["RULE A"] });
    expect(first).toBe(second);
    expect(first).not.toContain("STACK");
  });
});

describe("composePointer", () => {
  it("returns null when there is nothing to point at", () => {
    expect(composePointer({})).toBeNull();
  });

  it("names the rules document and stays far under the injection cap", () => {
    const out = composePointer({ rulesPath: ".claude/.jarrin-rules.md" });
    expect(out).toContain(".claude/.jarrin-rules.md");
    // The whole point of the pointer: it must never approach the ~25 KB at
    // which Claude Code truncates a hook's additionalContext.
    expect(out?.length ?? 0).toBeLessThan(1024);
  });

  it("injects stack status even when no rules are selected", () => {
    const out = composePointer({ stackStatus: "STACK ON 8001" });
    expect(out).not.toBeNull();
    expect(out).toContain("STACK ON 8001");
    expect(out).not.toContain("jarrin-rules.md");
  });
});
