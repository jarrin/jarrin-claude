import { basename, join } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyWorktreeConfig } from "../config/schema.js";
import {
  derivedWorktreeName,
  nextPort,
  planWorktree,
  validateWorktreeName,
} from "./plan.js";

const LOCAL = join(".claude", ".jarrin.local.yml");

describe("planWorktree", () => {
  it("defaults to the grouped-sibling <repo>-worktrees dir", () => {
    const plan = planWorktree({
      name: "feature-x",
      mainRoot: "/home/j/Projects/app",
      cfg: emptyWorktreeConfig(),
    });
    expect(plan.baseDir).toBe("/home/j/Projects/app-worktrees");
    expect(plan.path).toBe("/home/j/Projects/app-worktrees/feature-x");
    expect(plan.branch).toBe("feature-x");
  });

  it("resolves a relative cfg.dir against the main root (../ → bare sibling)", () => {
    const cfg = { ...emptyWorktreeConfig(), dir: "../" };
    const plan = planWorktree({ name: "wt", mainRoot: "/a/b/repo", cfg });
    expect(plan.path).toBe("/a/b/wt");
  });

  it("uses an absolute cfg.dir as-is", () => {
    const cfg = { ...emptyWorktreeConfig(), dir: "/tmp/wts" };
    const plan = planWorktree({ name: "wt", mainRoot: "/a/b/repo", cfg });
    expect(plan.path).toBe("/tmp/wts/wt");
  });

  it("always carries .jarrin.local.yml, deduped, ahead of configured copies", () => {
    const cfg = { ...emptyWorktreeConfig(), copy: [".env", LOCAL] };
    const plan = planWorktree({ name: "wt", mainRoot: "/r", cfg });
    expect(plan.copy).toEqual([LOCAL, ".env"]);
  });

  it("passes setup commands through in order", () => {
    const cfg = {
      ...emptyWorktreeConfig(),
      setup: ["poetry install", "docker compose up -d"],
    };
    const plan = planWorktree({ name: "wt", mainRoot: "/r", cfg });
    expect(plan.setup).toEqual(["poetry install", "docker compose up -d"]);
  });

  it("prefixes with the parent worktree but keeps the folder flat", () => {
    const plan = planWorktree({
      name: "x",
      parent: "dev",
      mainRoot: "/home/j/Projects/prdl-new",
      cfg: emptyWorktreeConfig(),
    });
    // Sibling of dev under the main root's base dir — never nested inside it.
    expect(plan.baseDir).toBe("/home/j/Projects/prdl-new-worktrees");
    expect(plan.path).toBe("/home/j/Projects/prdl-new-worktrees/dev-x");
    expect(plan.branch).toBe("dev-x");
  });

  it("keeps branch and directory basename identical", () => {
    const plan = planWorktree({
      name: "x",
      parent: "dev",
      mainRoot: "/r",
      cfg: emptyWorktreeConfig(),
    });
    expect(basename(plan.path)).toBe(plan.branch);
  });
});

describe("derivedWorktreeName", () => {
  it("leaves the name alone when created from the main checkout", () => {
    expect(derivedWorktreeName("", "x")).toBe("x");
  });

  it("prefixes with the parent worktree's stamped name", () => {
    expect(derivedWorktreeName("dev", "x")).toBe("dev-x");
    expect(derivedWorktreeName("dev-x", "y")).toBe("dev-x-y");
  });

  it("does not double-prefix an already-prefixed name", () => {
    expect(derivedWorktreeName("dev", "dev-x")).toBe("dev-x");
    expect(derivedWorktreeName("dev", "dev")).toBe("dev");
  });

  it("trims both sides", () => {
    expect(derivedWorktreeName(" dev ", " x ")).toBe("dev-x");
  });
});

describe("nextPort", () => {
  it("hands out the base when no worktree has a port yet", () => {
    expect(nextPort(8000, [])).toBe(8000);
  });

  it("climbs to one past the highest assigned port", () => {
    expect(nextPort(8000, [8000])).toBe(8001);
    expect(nextPort(8000, [8000, 8001, 8002])).toBe(8003);
  });

  it("ignores gaps and order — only the maximum matters", () => {
    expect(nextPort(8000, [8000, 8003])).toBe(8004);
    expect(nextPort(8000, [8005, 8001])).toBe(8006);
  });

  it("never drops below the base even if existing ports are lower", () => {
    expect(nextPort(9000, [8000, 8001])).toBe(9000);
  });

  it("treats a zero/negative base as no floor", () => {
    expect(nextPort(0, [])).toBe(0);
    expect(nextPort(0, [8000])).toBe(8001);
  });
});

describe("validateWorktreeName", () => {
  it("accepts a plain name and git slash syntax", () => {
    expect(validateWorktreeName("feature-x")).toBeNull();
    expect(validateWorktreeName("feature/x")).toBeNull();
  });

  it("rejects empty, leading dash, traversal and absolute paths", () => {
    expect(validateWorktreeName("")).not.toBeNull();
    expect(validateWorktreeName("   ")).not.toBeNull();
    expect(validateWorktreeName("-x")).not.toBeNull();
    expect(validateWorktreeName("../escape")).not.toBeNull();
    expect(validateWorktreeName("a/../b")).not.toBeNull();
    expect(validateWorktreeName("/abs")).not.toBeNull();
  });
});
