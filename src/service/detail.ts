import { basename, join } from "node:path";

import type {
  ProjectDetail,
  SessionStatus,
  WorktreeDetail,
} from "../../monitor/shared/protocol.js";
import { loadEffectiveConfig } from "../config/load.js";
import type { MilestoneSource } from "../loop/gitea.js";
import { parseWorktreeList } from "../worktree/merge.js";
import type { ProjectState, SessionRecord } from "./state.js";

/**
 * What a project tab in the web interface shows: the open milestones of the
 * project's backlog repo, and its checkouts (the main one first, then every
 * linked worktree) with the identity `worktree create` stamped into each and
 * the status of the session the service runs there.
 *
 * Collection is pure over {@link DetailDeps}: git, the stamped config and the
 * forge come in as functions, so the tests run it against fakes.
 */

/** A worktree's stamped identity (`.claude/.jarrin.local.yml`). */
export interface StampedIdentity {
  readonly name: string;
  readonly port: number;
  readonly milestone: string;
}

export interface DetailDeps {
  /** `git worktree list --porcelain` in `path`, or null when git fails. */
  readonly worktreeList: (path: string) => string | null;
  readonly identity: (worktreePath: string) => StampedIdentity;
  /** The forge client for a repo; null when no Gitea credentials resolve. */
  readonly forge: ((repo: string) => MilestoneSource) | null;
  /** The forge's web root, for milestone links; empty when unknown. */
  readonly forgeUrl: string;
  readonly now: () => number;
}

const message = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

function sessionStatus(
  sessions: readonly SessionRecord[],
  project: string,
  worktree: string,
): SessionStatus {
  const s = sessions.find(
    (r) => r.project === project && r.worktree === worktree,
  );
  return s ? s.status : "none";
}

/** The project's checkouts; the main checkout alone when git cannot list them. */
export function collectWorktrees(
  project: ProjectState,
  sessions: readonly SessionRecord[],
  deps: Pick<DetailDeps, "worktreeList" | "identity">,
): WorktreeDetail[] {
  const porcelain = deps.worktreeList(project.path);
  const entries = porcelain === null ? [] : parseWorktreeList(porcelain);
  const list =
    entries.length > 0 ? entries : [{ path: project.path, branch: null }];
  return list.map((e, i) => {
    const main = i === 0;
    const id = deps.identity(e.path);
    // A worktree made by a bare `git worktree add` has no stamp: fall back to
    // its directory name, as `claudjar goto` does.
    const name = main ? "" : id.name || basename(e.path);
    return {
      name,
      branch: e.branch ?? "",
      path: e.path,
      port: id.port,
      milestone: id.milestone,
      session: sessionStatus(sessions, project.name, name),
    };
  });
}

export async function collectDetail(
  project: ProjectState,
  sessions: readonly SessionRecord[],
  deps: DetailDeps,
): Promise<ProjectDetail> {
  const worktrees = collectWorktrees(project, sessions, deps);
  const repo = project.backlogRepo;
  let milestones: ProjectDetail["milestones"] = [];
  let error = "";
  if (!repo) {
    error = project.configured
      ? "no backlog repo configured"
      : "not a claudjar project";
  } else if (!deps.forge) {
    error = "no Gitea credentials on the host";
  } else {
    try {
      milestones = (await deps.forge(repo).openMilestones()).sort((a, b) =>
        a.title.localeCompare(b.title),
      );
    } catch (err) {
      error = message(err);
    }
  }
  return {
    project: project.name,
    repo,
    forge: repo && deps.forge ? deps.forgeUrl : "",
    milestones,
    worktrees,
    error,
    collectedAt: deps.now(),
  };
}

/** The stamped identity on disk; an unreadable config reads as unstamped. */
export function readIdentity(worktreePath: string): StampedIdentity {
  try {
    const w = loadEffectiveConfig(join(worktreePath, ".claude")).merged
      .worktree;
    return { name: w.name, port: w.port, milestone: w.milestone };
  } catch {
    return { name: "", port: 0, milestone: "" };
  }
}
