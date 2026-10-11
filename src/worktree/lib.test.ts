import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseConfig } from "../config/read.js";
import type { WorktreeDeps } from "./lib.js";
import { createWorktree, mergeWorktree, removeWorktree } from "./lib.js";
import type { RunSpec } from "./runner.js";
import { spawnRunner } from "./runner.js";

let parent: string;
let repo: string;
let log: string[];
let ran: RunSpec[];
let deps: WorktreeDeps;
let savedGitEnv: Record<string, string | undefined>;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
}

function writeConfig(root: string, file: string, yaml: string): void {
  mkdirSync(join(root, ".claude"), { recursive: true });
  writeFileSync(join(root, ".claude", file), yaml, "utf8");
}

/** Commit one file on whatever is checked out in `cwd`. */
function commitFile(cwd: string, file: string, body: string): void {
  writeFileSync(join(cwd, file), body);
  git(cwd, "add", "-A");
  git(cwd, "commit", "-qm", `edit ${file}`);
}

beforeEach(() => {
  // Git hooks export GIT_DIR & co., which win over `-C` — clear them so the
  // suite behaves the same inside the pre-commit hook (see remove.test.ts).
  savedGitEnv = {};
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("GIT_")) {
      savedGitEnv[key] = process.env[key];
      delete process.env[key];
    }
  }

  // Realpath: git reports worktree paths resolved, and macOS-style symlinked
  // tmp dirs would otherwise make path comparisons flaky.
  parent = realpathSync(mkdtempSync(join(tmpdir(), "claudjar-lib-")));
  repo = join(parent, "proj");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  // The local file is written into every worktree; ignoring it keeps
  // `git worktree remove` from refusing on an untracked file.
  writeFileSync(join(repo, ".gitignore"), ".claude/.jarrin.local.yml\n");
  writeConfig(repo, ".jarrin.yml", "project:\n  port: 8000\n");
  commitFile(repo, "README.md", "hello\n");

  log = [];
  ran = [];
  const spawn = spawnRunner(process.env);
  deps = {
    // Record every command, and keep git's own chatter out of the test output.
    run: (spec) => {
      ran.push(spec);
      return spawn({ ...spec, output: "quiet" });
    },
    log: (msg) => void log.push(msg),
    warn: (msg) => void log.push(msg),
    caddyDir: join(parent, "caddy"),
  };
});

afterEach(() => {
  rmSync(parent, { recursive: true, force: true });
  for (const [key, value] of Object.entries(savedGitEnv)) {
    if (value !== undefined) process.env[key] = value;
  }
});

describe("createWorktree", () => {
  it("creates and stamps a worktree from an explicit repo root", async () => {
    const result = await createWorktree(
      repo,
      { name: "dev", milestone: "plan-claudjar-service" },
      deps,
    );

    const path = join(parent, "proj-worktrees", "dev");
    expect(result).toEqual({
      ok: true,
      name: "dev",
      path,
      port: 8000,
      milestone: "plan-claudjar-service",
    });
    expect(git(path, "branch", "--show-current").trim()).toBe("dev");
    const local = parseConfig(
      readFileSync(join(path, ".claude", ".jarrin.local.yml"), "utf8"),
    );
    expect(local.worktree).toMatchObject({
      name: "dev",
      port: 8000,
      milestone: "plan-claudjar-service",
    });
    expect(log.join("")).toContain("linked milestone: plan-claudjar-service");
  });

  it("prefixes from the source worktree and does not inherit its milestone", async () => {
    await createWorktree(repo, { name: "dev", milestone: "plan-a" }, deps);
    const dev = join(parent, "proj-worktrees", "dev");

    const result = await createWorktree(dev, { name: "x" }, deps);

    expect(result).toMatchObject({
      ok: true,
      name: "dev-x",
      path: join(parent, "proj-worktrees", "dev-x"),
      port: 8001,
      milestone: "",
    });
    const local = parseConfig(
      readFileSync(
        join(parent, "proj-worktrees", "dev-x", ".claude", ".jarrin.local.yml"),
        "utf8",
      ),
    );
    expect(local.worktree.milestone).toBe("");
  });

  it("runs setup through the injected runner, in the new worktree", async () => {
    writeConfig(
      repo,
      ".jarrin.local.yml",
      "worktree:\n  setup:\n    - echo ok\n",
    );
    const result = await createWorktree(repo, { name: "dev" }, deps);

    expect(result.ok).toBe(true);
    const setup = ran.find((spec) => spec.command === "echo ok");
    expect(setup?.cwd).toBe(join(parent, "proj-worktrees", "dev"));
  });

  it("reports a failed setup with the worktree left in place", async () => {
    writeConfig(
      repo,
      ".jarrin.local.yml",
      "worktree:\n  setup:\n    - exit 4\n",
    );
    const result = await createWorktree(repo, { name: "dev" }, deps);

    const path = join(parent, "proj-worktrees", "dev");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("exit 4");
      expect(result.path).toBe(path);
    }
    expect(existsSync(path)).toBe(true);
  });

  it("rejects an invalid name without running anything", async () => {
    const result = await createWorktree(repo, { name: "-bad" }, deps);
    expect(result).toMatchObject({ ok: false, path: null });
    expect(ran).toEqual([]);
  });
});

describe("mergeWorktree", () => {
  it("merges into the checkout at repoRoot and keeps the worktree by default", async () => {
    await createWorktree(repo, { name: "dev" }, deps);
    const dev = join(parent, "proj-worktrees", "dev");
    commitFile(dev, "feature.txt", "done\n");

    const result = await mergeWorktree(repo, { name: "dev" }, deps);

    expect(result).toEqual({ ok: true, into: "main", removal: null });
    expect(existsSync(join(repo, "feature.txt"))).toBe(true);
    expect(existsSync(dev)).toBe(true);
  });

  it("removes the worktree and its merged branch with remove", async () => {
    await createWorktree(repo, { name: "dev" }, deps);
    const dev = join(parent, "proj-worktrees", "dev");
    commitFile(dev, "feature.txt", "done\n");

    const result = await mergeWorktree(
      repo,
      { name: "dev", remove: true },
      deps,
    );

    expect(result).toEqual({
      ok: true,
      into: "main",
      removal: { path: dev, branchKept: false, hookError: null },
    });
    expect(existsSync(dev)).toBe(false);
    expect(git(repo, "branch", "--list", "dev").trim()).toBe("");
  });

  it("returns the conflicted files and keeps everything", async () => {
    await createWorktree(repo, { name: "dev" }, deps);
    const dev = join(parent, "proj-worktrees", "dev");
    commitFile(dev, "README.md", "theirs\n");
    commitFile(repo, "README.md", "ours\n");

    const result = await mergeWorktree(
      repo,
      { name: "dev", remove: true },
      deps,
    );

    expect(result).toMatchObject({ ok: false, conflicts: ["README.md"] });
    expect(existsSync(dev)).toBe(true);
    git(repo, "merge", "--abort");
  });

  it("with abortOnConflict, aborts the merge and leaves the target as it was", async () => {
    await createWorktree(repo, { name: "dev" }, deps);
    const dev = join(parent, "proj-worktrees", "dev");
    commitFile(dev, "README.md", "theirs\n");
    commitFile(repo, "README.md", "ours\n");
    const before = git(repo, "rev-parse", "HEAD");

    const result = await mergeWorktree(
      repo,
      { name: "dev", remove: true, abortOnConflict: true },
      deps,
    );

    expect(result).toMatchObject({ ok: false, conflicts: ["README.md"] });
    if (!result.ok) expect(result.error).toContain("aborted, nothing changed");
    expect(git(repo, "status", "--porcelain")).toBe("");
    expect(git(repo, "rev-parse", "HEAD")).toBe(before);
    expect(readFileSync(join(repo, "README.md"), "utf8")).toBe("ours\n");
    expect(existsSync(dev)).toBe(true);
  });
});

describe("removeWorktree", () => {
  it("removes a worktree resolved from any checkout of the repo", async () => {
    await createWorktree(repo, { name: "dev" }, deps);
    const dev = join(parent, "proj-worktrees", "dev");

    const result = await removeWorktree(repo, { name: "dev" }, deps);

    expect(result).toEqual({
      ok: true,
      path: dev,
      branchKept: false,
      hookError: null,
    });
    expect(existsSync(dev)).toBe(false);
  });

  it("refuses to remove the worktree it runs from", async () => {
    await createWorktree(repo, { name: "dev" }, deps);
    const dev = join(parent, "proj-worktrees", "dev");

    const result = await removeWorktree(dev, { name: "dev" }, deps);

    expect(result.ok).toBe(false);
    expect(existsSync(dev)).toBe(true);
  });

  it("reports a branch with no worktree", async () => {
    const result = await removeWorktree(repo, { name: "ghost" }, deps);
    expect(result).toEqual({
      ok: false,
      error: "no worktree checked out for branch 'ghost'.",
    });
  });
});
