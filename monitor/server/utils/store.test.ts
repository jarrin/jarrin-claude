import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { StateFile } from "./store";

const saved = {
  instances: [],
  boards: [],
  questions: [],
  hosts: [],
  details: [],
};

describe("StateFile", () => {
  it("round-trips the saved state", () => {
    const dir = mkdtempSync(join(tmpdir(), "claudjar-monitor-"));
    const file = new StateFile(dir);
    expect(file.load()).toBeNull();
    file.save(saved);
    file.flush();
    expect(new StateFile(dir).load()).toEqual(saved);
  });

  it("reads a state file from before the host channel as having no hosts", () => {
    const dir = mkdtempSync(join(tmpdir(), "claudjar-monitor-"));
    writeFileSync(
      join(dir, "state.json"),
      JSON.stringify({ instances: [], boards: [], questions: [] }),
    );
    expect(new StateFile(dir).load()).toEqual(saved);
  });

  it("sets an unreadable file aside instead of overwriting it", () => {
    const dir = mkdtempSync(join(tmpdir(), "claudjar-monitor-"));
    writeFileSync(join(dir, "state.json"), "{ torn");
    expect(new StateFile(dir).load()).toBeNull();
    expect(readdirSync(dir).some((f) => f.includes(".corrupt-"))).toBe(true);
  });
});
