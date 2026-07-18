import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyConfig } from "../config/schema.js";
import {
  composeAdditionalContext,
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

describe("composeAdditionalContext", () => {
  it("returns null when only the header would be present", () => {
    expect(composeAdditionalContext({ ruleBlocks: [] })).toBeNull();
  });

  it("joins stack status, commands, rules and extra md with the header", () => {
    const out = composeAdditionalContext({
      stackStatus: "STACK ON 8001",
      commandsTable: "## Commands",
      ruleBlocks: ["RULE A", "RULE B"],
      extraMd: "PROJECT MD",
    });
    expect(out).not.toBeNull();
    expect(out).toContain("# Jarrin project rules");
    expect(out).toContain("STACK ON 8001");
    expect(out).toContain("RULE A\n\n---\n\nRULE B");
    expect(out).toContain("PROJECT MD");
    expect(out?.endsWith("\n")).toBe(true);
  });

  it("injects stack status even when no rules or commands are selected", () => {
    const out = composeAdditionalContext({
      stackStatus: "STACK ON 8001",
      ruleBlocks: [],
    });
    expect(out).not.toBeNull();
    expect(out).toContain("STACK ON 8001");
  });
});
