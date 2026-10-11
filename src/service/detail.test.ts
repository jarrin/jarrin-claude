import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { collectDetail, collectWorktrees, readIdentity } from "./detail.js";
import { fakeDetailDeps } from "./fake-detail.js";
import type { ProjectState, SessionRecord } from "./state.js";

const project = (over: Partial<ProjectState> = {}): ProjectState => ({
  name: "web",
  path: "/p/web",
  configured: true,
  backlogRepo: "o/web",
  active: true,
  ...over,
});

const session = (
  worktree: string,
  status: SessionRecord["status"],
): SessionRecord => ({
  name: worktree ? `web--${worktree}` : "web",
  label: worktree ? `web/${worktree}` : "web",
  project: "web",
  worktree,
  cwd: "/p/web",
  backend: "bg",
  startedAt: "",
  status,
});

const PORCELAIN = [
  "worktree /p/web",
  "HEAD 1111",
  "branch refs/heads/main",
  "",
  "worktree /p/web-worktrees/dev",
  "HEAD 2222",
  "branch refs/heads/dev",
  "",
  "worktree /p/web-worktrees/loose",
  "HEAD 3333",
  "detached",
  "",
].join("\n");

const deps = fakeDetailDeps({
  worktrees: { "/p/web": PORCELAIN },
  stamps: {
    "/p/web-worktrees/dev": { name: "dev", port: 8001, milestone: "plan-x" },
  },
  milestones: {
    "o/web": [
      { id: 2, title: "plan-x", openIssues: 3, closedIssues: 1 },
      { id: 1, title: "todo", openIssues: 4, closedIssues: 9 },
    ],
  },
  now: 42,
});

describe("collectWorktrees", () => {
  it("lists the main checkout first, then each worktree with its stamp and session", () => {
    expect(
      collectWorktrees(
        project(),
        [session("", "running"), session("dev", "stopped")],
        deps,
      ),
    ).toEqual([
      {
        name: "",
        branch: "main",
        path: "/p/web",
        port: 0,
        milestone: "",
        session: "running",
      },
      {
        name: "dev",
        branch: "dev",
        path: "/p/web-worktrees/dev",
        port: 8001,
        milestone: "plan-x",
        session: "stopped",
      },
      // Unstamped and detached: named after its directory.
      {
        name: "loose",
        branch: "",
        path: "/p/web-worktrees/loose",
        port: 0,
        milestone: "",
        session: "none",
      },
    ]);
  });

  it("falls back to the main checkout alone when git cannot list", () => {
    expect(collectWorktrees(project({ path: "/p/x" }), [], deps)).toEqual([
      {
        name: "",
        branch: "",
        path: "/p/x",
        port: 0,
        milestone: "",
        session: "none",
      },
    ]);
  });

  it("only counts the project's own sessions", () => {
    const other = { ...session("", "running"), project: "api" };
    const [main] = collectWorktrees(project(), [other], deps);
    expect(main?.session).toBe("none");
  });
});

describe("collectDetail", () => {
  it("collects the open milestones by title, and the worktrees", async () => {
    const d = await collectDetail(project(), [], deps);
    expect(d).toMatchObject({
      project: "web",
      repo: "o/web",
      forge: "https://git.example",
      error: "",
      collectedAt: 42,
    });
    expect(d.milestones.map((m) => m.title)).toEqual(["plan-x", "todo"]);
    expect(d.worktrees).toHaveLength(3);
  });

  it("reports a forge failure but still lists the worktrees", async () => {
    const failing = fakeDetailDeps({
      worktrees: { "/p/web": PORCELAIN },
      milestones: { "o/web": "Gitea GET /milestones failed: HTTP 404" },
    });
    const d = await collectDetail(project(), [], failing);
    expect(d.error).toBe("Gitea GET /milestones failed: HTTP 404");
    expect(d.milestones).toEqual([]);
    expect(d.worktrees).toHaveLength(3);
  });

  it("explains why there are no milestones", async () => {
    const noRepo = await collectDetail(project({ backlogRepo: "" }), [], deps);
    expect(noRepo.error).toBe("no backlog repo configured");
    const bare = await collectDetail(
      project({ backlogRepo: "", configured: false }),
      [],
      deps,
    );
    expect(bare.error).toBe("not a claudjar project");
    const noAuth = await collectDetail(
      project(),
      [],
      fakeDetailDeps({ forge: false }),
    );
    expect(noAuth).toMatchObject({
      error: "no Gitea credentials on the host",
      forge: "",
    });
  });
});

describe("readIdentity", () => {
  it("reads the stamp from the worktree's local config", () => {
    const dir = mkdtempSync(join(tmpdir(), "cj-detail-"));
    mkdirSync(join(dir, ".claude"));
    writeFileSync(
      join(dir, ".claude", ".jarrin.local.yml"),
      "worktree:\n  name: dev\n  port: 8002\n  milestone: plan-y\n",
    );
    expect(readIdentity(dir)).toEqual({
      name: "dev",
      port: 8002,
      milestone: "plan-y",
    });
  });

  it("reads a checkout without config as unstamped", () => {
    expect(readIdentity(mkdtempSync(join(tmpdir(), "cj-detail-")))).toEqual({
      name: "",
      port: 0,
      milestone: "",
    });
  });
});
