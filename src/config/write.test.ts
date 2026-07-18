import { describe, expect, it } from "vitest";

import { parseConfig } from "./read.js";
import { emptyConfig } from "./schema.js";
import { serializeConfig } from "./write.js";

describe("serializeConfig", () => {
  it("renders a commented template for a new file", () => {
    const cfg = emptyConfig();
    cfg.rules.push("lang-ts");
    const out = serializeConfig(cfg);
    expect(out).toContain("rules:");
    expect(out).toContain("  - lang-ts");
    expect(out).toContain("# Jarrin project rules");
  });

  it("preserves comments and the backlog block on update", () => {
    const existing = [
      "# hand-written header",
      "rules:",
      "  - lang-ts",
      "backlog:",
      "  repo: owner/name",
      "  plan:",
      "    method: gitea",
      "",
    ].join("\n");

    const cfg = parseConfig(existing);
    cfg.rules.push("fw-laravel");
    cfg.backup = "echo hi";

    const out = serializeConfig(cfg, existing);
    expect(out).toContain("# hand-written header");
    expect(out).toContain("backlog:");
    expect(out).toContain("method: gitea");
    expect(out).toContain("- fw-laravel");
    expect(out).toContain("backup: echo hi");
  });

  it("removes a tier that becomes empty and drops backup when cleared", () => {
    const existing = "rules:\n  - lang-ts\nbackup: echo old\n";
    const cfg = parseConfig(existing);
    cfg.rules.length = 0;
    cfg.backup = "";
    const out = serializeConfig(cfg, existing);
    expect(out).not.toContain("rules:");
    expect(out).not.toContain("backup:");
  });

  it("round-trips through parse → serialize → parse", () => {
    const cfg = emptyConfig();
    cfg.rules.push("lang-ts", "fw-nuxtjs");
    cfg.imports.push({ owner: "server", rule: "prdl" });
    cfg.commands.push({ cmd: "pnpm check", desc: "gates" });
    cfg.backup = "echo backup";

    const reparsed = parseConfig(serializeConfig(cfg));
    expect(reparsed).toEqual(cfg);
  });
});
