import { detailKey, loopsFor } from "#shared/protocol";
import type {
  CommandOutcome,
  HostCommand,
  InstanceSummary,
  MilestoneDetail,
  ProjectDetailView,
  ProjectInfo,
  WorktreeDetail,
  WorktreeMode,
} from "#shared/protocol";

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
