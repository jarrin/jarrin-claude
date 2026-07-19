import { describe, expect, it } from "vitest";

import type { CaddyEntry } from "./route.js";
import {
  PROJECT_CADDY_PORT,
  entryKey,
  hostsFor,
  renderCaddyfile,
  sortEntries,
  toLabel,
  upstreamFor,
} from "./route.js";

const entry = (
  slug: string,
  worktree: string,
  root = `/repos/${slug}`,
): CaddyEntry => ({
  slug,
  worktree,
  upstream: upstreamFor(slug, worktree),
  root,
});

describe("toLabel", () => {
  it("reduces a git branch name to one DNS label", () => {
    // The reason this exists: `feature/x` is an ordinary branch name and an
    // illegal hostname label.
    expect(toLabel("feature/x")).toBe("feature-x");
    expect(toLabel("Feature/Some_Thing")).toBe("feature-some-thing");
  });

  it("collapses runs and trims stray hyphens", () => {
    expect(toLabel("--a//__b--")).toBe("a-b");
  });

  it("maps an empty or punctuation-only name to the empty label", () => {
    expect(toLabel("")).toBe("");
    expect(toLabel("///")).toBe("");
  });
});

describe("upstreamFor", () => {
  it("names a main checkout's container from the slug alone", () => {
    expect(upstreamFor("prdl", "")).toBe("caddy-prdl");
  });

  it("suffixes a worktree so siblings never collide", () => {
    expect(upstreamFor("prdl", "dev")).toBe("caddy-prdl-dev");
    expect(upstreamFor("prdl", "dev-x")).toBe("caddy-prdl-dev-x");
  });
});

describe("hostsFor", () => {
  it("puts a main checkout at the root of its domain", () => {
    expect(hostsFor("prdl", "")).toEqual([
      "prdl.localhost",
      "*.prdl.localhost",
    ]);
  });

  it("puts a worktree one segment below the project", () => {
    expect(hostsFor("prdl", "dev")).toEqual([
      "dev.prdl.localhost",
      "*.dev.prdl.localhost",
    ]);
  });

  it("overlaps main's wildcard with a worktree's exact host, by design", () => {
    // `dev.prdl.localhost` matches BOTH main's `*.prdl.localhost` and the dev
    // worktree's own exact host. Caddy resolves that correctly on its own (exact
    // beats wildcard) — this pins that both sides really do claim it, so the
    // overlap is a known property rather than an accident.
    const [, mainWildcard] = hostsFor("prdl", "");
    const [worktreeExact] = hostsFor("prdl", "dev");
    expect(mainWildcard).toBe("*.prdl.localhost");
    expect(worktreeExact).toBe("dev.prdl.localhost");
  });
});

describe("entryKey", () => {
  it("identifies a route by project + worktree", () => {
    expect(entryKey({ slug: "prdl", worktree: "" })).not.toBe(
      entryKey({ slug: "prdl", worktree: "dev" }),
    );
  });

  it("is label-normalised, so feature/x and feature-x are one route", () => {
    expect(entryKey({ slug: "prdl", worktree: "feature/x" })).toBe(
      entryKey({ slug: "prdl", worktree: "feature-x" }),
    );
  });
});

describe("sortEntries", () => {
  it("orders by slug then worktree, so regeneration is stable", () => {
    const sorted = sortEntries([
      entry("zed", ""),
      entry("prdl", "dev"),
      entry("prdl", ""),
    ]);
    expect(sorted.map((e) => `${e.slug}/${e.worktree}`)).toEqual([
      "prdl/",
      "prdl/dev",
      "zed/",
    ]);
  });
});

describe("renderCaddyfile", () => {
  it("disables auto_https, since only host port 80 is published", () => {
    // Caddy treats .localhost as internal and would otherwise issue certs for it.
    expect(renderCaddyfile([])).toContain("auto_https off");
  });

  it("schemes every site address, which is what actually binds port 80", () => {
    // Regression: a bare `prdl.localhost {` binds Caddy's HTTPS port (443) even
    // with auto_https off — the directive governs certificates, not the default
    // port. claudjar publishes host port 80 only, so an unschemed site listens
    // where nothing is mapped and every request is refused. Caught live.
    const out = renderCaddyfile([entry("prdl", "")]);
    for (const line of out.split("\n")) {
      if (!line.endsWith(" {") || line.startsWith("{")) continue;
      for (const address of line.slice(0, -2).split(", ")) {
        expect(address.startsWith("http://")).toBe(true);
      }
    }
  });

  it("says so when nothing is registered, rather than emitting a bare global block", () => {
    expect(renderCaddyfile([])).toContain("No projects registered");
  });

  it("emits one site block per entry, proxying to the project's own caddy", () => {
    const out = renderCaddyfile([entry("prdl", "")]);
    expect(out).toContain("http://prdl.localhost, http://*.prdl.localhost {");
    expect(out).toContain(
      `\treverse_proxy caddy-prdl:${String(PROJECT_CADDY_PORT)}`,
    );
  });

  it("routes a worktree to its own upstream", () => {
    const out = renderCaddyfile([entry("prdl", "dev")]);
    expect(out).toContain(
      "http://dev.prdl.localhost, http://*.dev.prdl.localhost {",
    );
    expect(out).toContain(
      `\treverse_proxy caddy-prdl-dev:${String(PROJECT_CADDY_PORT)}`,
    );
  });

  it("is deterministic regardless of input order", () => {
    const a = renderCaddyfile([entry("prdl", ""), entry("zed", "")]);
    const b = renderCaddyfile([entry("zed", ""), entry("prdl", "")]);
    expect(a).toBe(b);
  });

  it("comments each block with the repo it came from", () => {
    expect(
      renderCaddyfile([entry("prdl", "dev", "/repos/prdl-dev")]),
    ).toContain("# prdl (dev) — /repos/prdl-dev");
  });
});
