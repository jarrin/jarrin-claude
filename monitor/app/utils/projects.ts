import { ABORTED_STATUS, detailKey, loopsFor } from "#shared/protocol";
import type {
  CommandOutcome,
  HostCommand,
  InstanceInfo,
  InstanceSummary,
  MilestoneDetail,
  ProjectDetailView,
  ProjectInfo,
  Question,
  WorktreeDetail,
  WorktreeMode,
} from "#shared/protocol";

import { openQuestionsOf } from "./instances";
import type { MonitorState } from "./instances";

/** Prefix of a project tab's value, so it never collides with a loop instance id. */
const TAB_PREFIX = "project:";

/** One open project, as its tab shows it. */
export interface ProjectTab {
  /** The tab value. */
  readonly value: string;
  readonly host: string;
  readonly online: boolean;
  readonly project: ProjectInfo;
  /** What the host last collected; null until it arrives. */
  readonly detail: ProjectDetailView | null;
}

export function projectTabValue(host: string, project: string): string {
  return TAB_PREFIX + detailKey(host, project);
}

export function isProjectTab(value: string | null): boolean {
  return value?.startsWith(TAB_PREFIX) ?? false;
}

/** A tab per active project, host by host; closing a project removes its tab. */
export function projectTabs(state: MonitorState): ProjectTab[] {
  return state.hosts.flatMap((h) =>
    h.projects
      .filter((p) => p.active)
      .map((p) => ({
        value: projectTabValue(h.host, p.name),
        host: h.host,
        online: h.online,
        project: p,
        detail:
          state.details.find(
            (d) => d.host === h.host && d.project === p.name,
          ) ?? null,
      })),
  );
}

/** How a worktree is named in the UI: its stamped name, or "main". */
export function worktreeLabel(w: Pick<WorktreeDetail, "name">): string {
  return w.name || "main";
}

/** The loop instances working a worktree's linked milestone on its host. */
export function worktreeLoops(
  instances: readonly InstanceSummary[],
  detail: ProjectDetailView,
  worktree: WorktreeDetail,
): InstanceSummary[] {
  return loopsFor(instances, detail.host, detail.repo, worktree);
}

/**
 * The unanswered questions of the loops working any of a project's worktrees,
 * once each: two loops on one milestone see the same question.
 */
export function projectOpenQuestions(
  state: MonitorState,
  detail: ProjectDetailView | null,
): Question[] {
  if (!detail) return [];
  const found = new Map<string, Question>();
  for (const w of detail.worktrees)
    for (const inst of worktreeLoops(state.instances, detail, w))
      for (const q of openQuestionsOf(state, inst)) found.set(q.id, q);
  return [...found.values()];
}

/** The online loops on a project's host and repo that work a milestone. */
export function milestoneLoops(
  instances: readonly InstanceSummary[],
  detail: ProjectDetailView,
  milestoneId: number,
): InstanceSummary[] {
  return instances.filter(
    (i) =>
      i.online &&
      i.host === detail.host &&
      i.repo === detail.repo &&
      i.milestones.some((m) => m.id === milestoneId),
  );
}

/**
 * The `create-worktree` command for the UI's inputs: a blank name is left out
 * (the host derives one from the milestone), as is a missing milestone.
 */
export function createWorktreeCommand(
  project: string,
  mode: WorktreeMode,
  name: string,
  milestone: Pick<MilestoneDetail, "id" | "title"> | null,
): HostCommand {
  const trimmed = name.trim();
  return {
    type: "create-worktree",
    project,
    mode,
    ...(trimmed ? { name: trimmed } : {}),
    ...(milestone
      ? { milestone: { id: milestone.id, title: milestone.title } }
      : {}),
  };
}

/** The outcome of the command sent as `id`; null while it is still in flight. */
export function outcomeOf(
  outcomes: readonly CommandOutcome[],
  id: string,
): CommandOutcome | null {
  return outcomes.find((o) => o.id === id) ?? null;
}

/** A loop that has ended: finished, aborted, or interrupted by a hard exit. */
export function loopEnded(status: string): boolean {
  return (
    status === ABORTED_STATUS ||
    status === "interrupted" ||
    status.startsWith("finished")
  );
}

/** A loop instance that still works: connected and not ended. */
export function loopRunning(i: Pick<InstanceSummary, "online" | "status">) {
  return i.online && !loopEnded(i.status);
}

/** Which worktree actions apply, and why the unavailable ones are not. */
export interface WorktreeActionState {
  /** The loop to abort: the service's (by pid) or a connected instance. */
  readonly running: boolean;
  readonly canAbort: boolean;
  readonly canRestart: boolean;
  readonly canMerge: boolean;
  readonly canRemove: boolean;
  /** Why merge / restart are disabled; empty when they are not. */
  readonly hint: string;
}

export function worktreeActionState(
  worktree: Pick<WorktreeDetail, "name" | "session" | "milestone" | "loopPid">,
  loops: readonly Pick<InstanceSummary, "online" | "status">[],
  online: boolean,
): WorktreeActionState {
  if (!worktree.name)
    return {
      running: false,
      canAbort: false,
      canRestart: false,
      canMerge: false,
      canRemove: false,
      hint: "the main checkout",
    };
  // A connected loop's own status wins (the recorded pid goes stale between
  // detail refreshes); the pid alone counts until its loop has connected.
  const running =
    loops.length > 0 ? loops.some(loopRunning) : worktree.loopPid > 0;
  const session = worktree.session === "running";
  const hint = !online
    ? "the host is offline"
    : running
      ? "a loop runs here — abort it first"
      : session
        ? "a session runs here — end it first"
        : "";
  return {
    running,
    canAbort: online && running,
    canRestart: online && !running && !session && worktree.milestone !== "",
    canMerge: online && !running && !session,
    canRemove: online,
    hint,
  };
}

/** A command on one worktree of a project. */
export function worktreeCommand(
  type: "stop-loop" | "resume-loop" | "remove-worktree",
  project: string,
  worktree: string,
): HostCommand;
export function worktreeCommand(
  type: "merge-worktree",
  project: string,
  worktree: string,
  remove: boolean,
): HostCommand;
export function worktreeCommand(
  type: "stop-loop" | "resume-loop" | "remove-worktree" | "merge-worktree",
  project: string,
  worktree: string,
  remove = false,
): HostCommand {
  return type === "merge-worktree"
    ? { type, project, worktree, remove }
    : { type, project, worktree };
}

/**
 * The project and worktree a loop instance works in, from the hosts' details:
 * the worktree pinned to its pid, else the one on its host and repo linked to
 * one of its milestones. Null when no open project shows it.
 */
export function worktreeOfInstance(
  details: readonly ProjectDetailView[],
  instance: Pick<InstanceInfo, "host" | "repo" | "milestones" | "pid">,
): { detail: ProjectDetailView; worktree: WorktreeDetail } | null {
  const mine = details.filter(
    (d) => d.host === instance.host && d.repo === instance.repo,
  );
  for (const detail of mine) {
    const worktree = detail.worktrees.find(
      (w) => w.name && w.loopPid === instance.pid,
    );
    if (worktree) return { detail, worktree };
  }
  for (const detail of mine) {
    const worktree = detail.worktrees.find(
      (w) =>
        w.name &&
        w.milestone &&
        instance.milestones.some((m) => m.title === w.milestone),
    );
    if (worktree) return { detail, worktree };
  }
  return null;
}
