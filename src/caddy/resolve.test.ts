import { describe, expect, it } from "vitest";

import { parseConfig } from "../config/read.js";
import { resolveTarget } from "./resolve.js";

const cfg = (yaml: string) => parseConfig(yaml);

describe("resolveTarget", () => {
  it("returns null without a project.slug — no name, no route", () => {
    expect(resolveTarget(cfg("caddy:\n  enabled: true\n"), "/r")).toBeNull();
  });

  it("resolves a main checkout to the root of its domain", () => {
    const target = resolveTarget(
      cfg("project:\n  slug: prdl\ncaddy:\n  enabled: true\n"),
      "/repos/prdl",
    );
    expect(target?.entry).toEqual({
      slug: "prdl",
      worktree: "",
      upstream: "caddy-prdl",
      root: "/repos/prdl",
    });
    expect(target?.hosts[0]).toBe("prdl.localhost");
  });

  it("uses the stamped worktree.name as the middle segment", () => {
    const target = resolveTarget(
      cfg("project:\n  slug: prdl\nworktree:\n  name: dev\n"),
      "/repos/prdl-dev",
    );
    expect(target?.hosts[0]).toBe("dev.prdl.localhost");
    expect(target?.entry.upstream).toBe("caddy-prdl-dev");
  });

  it("lets worktree.slug override the segment, for long branch names", () => {
    const target = resolveTarget(
      cfg(
        "project:\n  slug: prdl\nworktree:\n  name: feature/long-name\n  slug: fl\n",
      ),
      "/r",
    );
    expect(target?.hosts[0]).toBe("fl.prdl.localhost");
  });

  it("normalises a branch-shaped worktree name into a hostname label", () => {
    const target = resolveTarget(
      cfg("project:\n  slug: prdl\nworktree:\n  name: feature/x\n"),
      "/r",
    );
    expect(target?.hosts[0]).toBe("feature-x.prdl.localhost");
  });

  it("reports `enabled` rather than enforcing it", () => {
    // join refuses when it is false; leave must still resolve so a repo that
    // opted out can retire the route it already registered.
    const target = resolveTarget(cfg("project:\n  slug: prdl\n"), "/r");
    expect(target).not.toBeNull();
    expect(target?.enabled).toBe(false);
  });
});
