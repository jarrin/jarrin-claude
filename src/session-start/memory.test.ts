import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  hasMemoryImport,
  writeRulesDocument,
  MEMORY_IMPORT,
  MEMORY_REL,
} from "./memory.js";

function repo(): string {
  return mkdtempSync(join(tmpdir(), "jarrin-memory-"));
}

describe("writeRulesDocument", () => {
  it("creates .claude/ and writes the document", () => {
    const cwd = repo();
    expect(writeRulesDocument(cwd, "RULES\n")).toBe(true);
    expect(readFileSync(join(cwd, MEMORY_REL), "utf8")).toBe("RULES\n");
  });

  it("reports no change and leaves the file untouched when content matches", () => {
    const cwd = repo();
    writeRulesDocument(cwd, "RULES\n");
    const before = statSync(join(cwd, MEMORY_REL)).mtimeMs;

    expect(writeRulesDocument(cwd, "RULES\n")).toBe(false);
    expect(statSync(join(cwd, MEMORY_REL)).mtimeMs).toBe(before);
  });

  it("rewrites when the content changed", () => {
    const cwd = repo();
    writeRulesDocument(cwd, "OLD\n");
    expect(writeRulesDocument(cwd, "NEW\n")).toBe(true);
    expect(readFileSync(join(cwd, MEMORY_REL), "utf8")).toBe("NEW\n");
  });
});

describe("hasMemoryImport", () => {
  it("is false when CLAUDE.md is absent", () => {
    expect(hasMemoryImport(repo())).toBe(false);
  });

  it("is false when CLAUDE.md does not import the document", () => {
    const cwd = repo();
    writeFileSync(join(cwd, "CLAUDE.md"), "# Project\n", "utf8");
    expect(hasMemoryImport(cwd)).toBe(false);
  });

  it("is true when the import line is present", () => {
    const cwd = repo();
    writeFileSync(
      join(cwd, "CLAUDE.md"),
      `# Project\n\n${MEMORY_IMPORT}\n`,
      "utf8",
    );
    expect(hasMemoryImport(cwd)).toBe(true);
  });

  it("ignores a directory named CLAUDE.md rather than throwing", () => {
    const cwd = repo();
    mkdirSync(join(cwd, "CLAUDE.md"));
    expect(hasMemoryImport(cwd)).toBe(false);
  });
});
