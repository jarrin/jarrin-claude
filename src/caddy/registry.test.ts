import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  caddyfilePath,
  parseRegistry,
  readRegistry,
  registryPath,
  removeEntry,
  serializeRegistry,
  upsertEntry,
  writeRegistry,
} from "./registry.js";
import type { CaddyEntry } from "./route.js";
import { upstreamFor } from "./route.js";

const entry = (slug: string, worktree = ""): CaddyEntry => ({
  slug,
  worktree,
  upstream: upstreamFor(slug, worktree),
  root: `/repos/${slug}`,
});

describe("parseRegistry", () => {
  it("degrades a malformed registry to empty rather than throwing", () => {
    // Same contract as parseConfig: a broken file must not wedge every caddy
    // command on the machine.
    expect(parseRegistry("entries: [oops")).toEqual([]);
    expect(parseRegistry("")).toEqual([]);
    expect(parseRegistry("- a\n- b\n")).toEqual([]);
  });

  it("drops entries with no slug — there is nothing to route", () => {
    expect(parseRegistry("entries:\n  - worktree: dev\n")).toEqual([]);
  });

  it("derives a missing upstream instead of dropping the entry", () => {
    // A registry written by an older claudjar predates the field; deriving keeps
    // the route working rather than emitting `reverse_proxy :8000`.
    const [first] = parseRegistry("entries:\n  - slug: prdl\n");
    expect(first?.upstream).toBe("caddy-prdl");
  });

  it("round-trips through serializeRegistry", () => {
    const entries = [entry("prdl"), entry("prdl", "dev")];
    expect(parseRegistry(serializeRegistry(entries))).toEqual(entries);
  });
});

describe("upsertEntry", () => {
  it("adds a new route", () => {
    expect(upsertEntry([], entry("prdl"))).toEqual([entry("prdl")]);
  });

  it("replaces the route for the same project + worktree", () => {
    const stale = { ...entry("prdl"), root: "/old" };
    const result = upsertEntry([stale], entry("prdl"));
    expect(result).toHaveLength(1);
    expect(result[0]?.root).toBe("/repos/prdl");
  });

  it("keeps a worktree's route distinct from its project's", () => {
    const result = upsertEntry([entry("prdl")], entry("prdl", "dev"));
    expect(result).toHaveLength(2);
  });
});

describe("removeEntry", () => {
  it("drops only the named route", () => {
    const entries = [entry("prdl"), entry("prdl", "dev"), entry("zed")];
    expect(removeEntry(entries, "prdl", "dev").map((e) => e.slug)).toEqual([
      "prdl",
      "zed",
    ]);
  });

  it("is a no-op for a route that was never registered", () => {
    expect(removeEntry([entry("prdl")], "nope", "")).toHaveLength(1);
  });
});

describe("writeRegistry / readRegistry", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "claudjar-caddy-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("treats a missing registry as empty, not an error", () => {
    expect(readRegistry(join(dir, "nope"))).toEqual([]);
  });

  it("writes the registry and regenerates the Caddyfile beside it", () => {
    writeRegistry(dir, [entry("prdl", "dev")]);
    expect(readRegistry(dir)).toEqual([entry("prdl", "dev")]);
    expect(readFileSync(caddyfilePath(dir), "utf8")).toContain(
      "dev.prdl.localhost",
    );
  });

  it("regenerates the Caddyfile from the registry on every write", () => {
    writeRegistry(dir, [entry("prdl")]);
    writeRegistry(dir, removeEntry(readRegistry(dir), "prdl", ""));
    const caddyfile = readFileSync(caddyfilePath(dir), "utf8");
    expect(caddyfile).not.toContain("prdl.localhost");
    expect(caddyfile).toContain("No projects registered");
  });

  it("survives a corrupt registry by reporting nothing registered", () => {
    writeRegistry(dir, [entry("prdl")]);
    writeFileSync(registryPath(dir), "entries: [broken", "utf8");
    expect(readRegistry(dir)).toEqual([]);
  });
});
