import type {
  HostCommand,
  MilestoneRef,
  WorktreeMode,
} from "../../monitor/shared/protocol.js";
import { worktreeNameFor } from "../../monitor/shared/protocol.js";
import { launcherName, sessionLabel } from "../session/names.js";
import type { CreateOptions, CreateResult } from "../worktree/lib.js";
import { validateWorktreeName } from "../worktree/plan.js";
import type { SessionDeps } from "./sessions.js";
import type {
  LoopRecord,
  ProjectState,
  ServiceState,
  SessionRecord,
} from "./state.js";

/**
 * `create-worktree`: the web interface's way to add a worktree to an open
 * project and start something in it.
 *
 * - `mode: "loop"` stamps the milestone into the new worktree and starts a
 *   `claudjar loop` for it there — detached, in a scope of its own, so it
 *   outlives a service restart. The loop's pid is recorded, which is what pins
 *   the worktree to the loop's monitor instance (`loopsFor`).
 * - `mode: "session"` starts a plain background Claude session in it, named
 *   `<project>/<worktree>` for the app and `claudjar attach`.
 *
 * A milestone some loop already works is refused before anything is created —
 * the loop's own per-milestone lock would refuse it anyway, but only after a
 * worktree had been made for nothing.
 */

export type CreateWorktreeCommand = Extract<
  HostCommand,
  { readonly type: "create-worktree" }
>;

/** What `startLoop` needs to launch a loop in a worktree. */
export interface LoopSpec {
  readonly cwd: string;
  /** The backlog repo the loop works (`owner/name`). */
  readonly repo: string;
  readonly milestone: MilestoneRef;
  /** `<project>/<worktree>`, for the loop's log file name. */
  readonly label: string;
}

export interface CreateDeps {
  readonly create: (
    repoRoot: string,
    opts: CreateOptions,
  ) => Promise<CreateResult>;
  /** The pid of a live loop holding `milestoneId`'s lock in `repo`, or null. */
  readonly loopHolder: (repo: string, milestoneId: number) => number | null;
  /** Launch the loop; rejects when it cannot start or exits straight away. */
  readonly startLoop: (
    spec: LoopSpec,
  ) => Promise<{ readonly pid: number; readonly log: string }>;
  readonly isAlive: (pid: number) => boolean;
  readonly session: SessionDeps;
}

/** A validated request: everything checked that can be before creating anything. */
export interface CreatePlan {
  readonly project: ProjectState;
  readonly name: string;
  readonly milestone: MilestoneRef | null;
  readonly mode: WorktreeMode;
}

export type Planned =
  | ({ readonly ok: true } & CreatePlan)
  | { readonly ok: false; readonly error: string };

export type Created =
  | {
      readonly ok: true;
      /** The new worktree's name (its branch and stamped `worktree.name`). */
      readonly name: string;
      readonly path: string;
      readonly session: SessionRecord | null;
      readonly loop: LoopRecord | null;
      /** What happened, for the log. */
      readonly note: string;
    }
  | { readonly ok: false; readonly error: string };

const message = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/** The live loop the service started on a milestone of a project's repo, if any. */
function recordedLoop(
  state: ServiceState,
  project: string,
  milestoneId: number,
  isAlive: (pid: number) => boolean,
): LoopRecord | null {
  return (
    state.loops.find(
      (l) =>
        l.project === project &&
        l.milestone.id === milestoneId &&
        isAlive(l.pid),
    ) ?? null
  );
}

/** Refuse a milestone some loop already works; null when it is free. */
function milestoneTaken(
  state: ServiceState,
  project: ProjectState,
  milestone: MilestoneRef,
  deps: Pick<CreateDeps, "loopHolder" | "isAlive">,
): string | null {
  const recorded = recordedLoop(
    state,
    project.name,
    milestone.id,
    deps.isAlive,
  );
  if (recorded)
    return (
      `milestone "${milestone.title}" is already worked by a loop in worktree ` +
      `${recorded.worktree} (pid ${String(recorded.pid)})`
    );
  const holder = deps.loopHolder(project.backlogRepo, milestone.id);
  if (holder !== null)
    return `milestone "${milestone.title}" is already worked by a loop (pid ${String(holder)})`;
  return null;
}

/** Validate a `create-worktree` against the state, before anything is created. */
export function planCreate(
  state: ServiceState,
  cmd: CreateWorktreeCommand,
  deps: Pick<CreateDeps, "loopHolder" | "isAlive">,
): Planned {
  const project = state.projects.find((p) => p.name === cmd.project);
  if (!project)
    return { ok: false, error: `no project named '${cmd.project}'` };
  if (!project.active)
    return { ok: false, error: `open project '${cmd.project}' first` };

  const milestone = cmd.milestone ?? null;
  if (cmd.mode === "loop") {
    if (!milestone)
      return { ok: false, error: "a loop needs a milestone to work" };
    if (!project.backlogRepo)
      return {
        ok: false,
        error: `project '${cmd.project}' has no backlog repo for a loop to work`,
      };
  }

  const name =
    cmd.name?.trim() || (milestone ? worktreeNameFor(milestone.title) : "");
  if (!name)
    return {
      ok: false,
      error: milestone
        ? `cannot derive a worktree name from "${milestone.title}" — name it`
        : "name the worktree, or pick a milestone to name it after",
    };
  const invalid = validateWorktreeName(name);
  if (invalid) return { ok: false, error: invalid };

  if (cmd.mode === "loop" && milestone) {
    const taken = milestoneTaken(state, project, milestone, deps);
    if (taken) return { ok: false, error: taken };
  }
  return { ok: true, project, name, milestone, mode: cmd.mode };
}

/**
 * Create the worktree and start its loop or session. `current` is read again
 * after the (minutes-long) create, so a loop started meanwhile is still seen.
 * The records to add come back in the result; the caller folds them into the
 * state with {@link withCreated}.
 */
export async function createWorktreeFor(
  current: () => ServiceState,
  cmd: CreateWorktreeCommand,
  deps: CreateDeps,
): Promise<Created> {
  const plan = planCreate(current(), cmd, deps);
  if (!plan.ok) return plan;
  const { project, milestone } = plan;

  let made: CreateResult;
  try {
    made = await deps.create(project.path, {
      name: plan.name,
      ...(milestone ? { milestone: milestone.title } : {}),
    });
  } catch (err) {
    return { ok: false, error: `cannot create the worktree: ${message(err)}` };
  }
  if (!made.ok)
    return {
      ok: false,
      error: made.path
        ? `${made.error} (the worktree was left at ${made.path})`
        : made.error,
    };

  const label = sessionLabel(project.name, made.name);
  const started = deps.session.now.toISOString();
  const partly = `worktree ${made.name} was created at ${made.path}, but`;

  if (plan.mode === "loop" && milestone) {
    const taken = milestoneTaken(current(), project, milestone, deps);
    if (taken) return { ok: false, error: `${partly} ${taken}` };
    try {
      const loop = await deps.startLoop({
        cwd: made.path,
        repo: project.backlogRepo,
        milestone,
        label,
      });
      return {
        ok: true,
        name: made.name,
        path: made.path,
        session: null,
        loop: {
          project: project.name,
          worktree: made.name,
          cwd: made.path,
          milestone: { id: milestone.id, title: milestone.title },
          pid: loop.pid,
          log: loop.log,
          startedAt: started,
        },
        note: `created worktree ${made.name}, loop on "${milestone.title}" (pid ${String(loop.pid)})`,
      };
    } catch (err) {
      return {
        ok: false,
        error: `${partly} its loop did not start: ${message(err)}`,
      };
    }
  }

  const backend = deps.session.backend;
  let name: string;
  try {
    name = launcherName(label);
    deps.session.launcherFor(backend).start(name, made.path);
  } catch (err) {
    return {
      ok: false,
      error: `${partly} its session did not start: ${message(err)}`,
    };
  }
  return {
    ok: true,
    name: made.name,
    path: made.path,
    session: {
      name,
      label,
      project: project.name,
      worktree: made.name,
      cwd: made.path,
      backend,
      startedAt: started,
      status: "running",
    },
    loop: null,
    note: `created worktree ${made.name}, session ${label} (${backend})`,
  };
}

/** Fold a successful create's records into the state. */
export function withCreated(
  state: ServiceState,
  created: Extract<Created, { readonly ok: true }>,
  now: Date,
): ServiceState {
  const { session, loop } = created;
  return {
    ...state,
    updatedAt: now.toISOString(),
    sessions: session
      ? [...state.sessions.filter((s) => s.label !== session.label), session]
      : state.sessions,
    loops: loop
      ? [
          ...state.loops.filter(
            (l) =>
              !(l.project === loop.project && l.worktree === loop.worktree),
          ),
          loop,
        ]
      : state.loops,
  };
}

/** Drop the records of loops that are no longer running (on service start). */
export function pruneLoops(
  state: ServiceState,
  isAlive: (pid: number) => boolean,
): { readonly state: ServiceState; readonly notes: readonly string[] } {
  const notes: string[] = [];
  const loops = state.loops.filter((l) => {
    if (isAlive(l.pid)) return true;
    notes.push(
      `loop ${sessionLabel(l.project, l.worktree)} (pid ${String(l.pid)}) is gone`,
    );
    return false;
  });
  return { state: { ...state, loops }, notes };
}

/** The pid of the live loop the service started in a worktree; 0 when none. */
export function loopPidFor(
  loops: readonly LoopRecord[],
  project: string,
  worktree: string,
  isAlive: (pid: number) => boolean,
): number {
  const l = loops.find(
    (r) => r.project === project && r.worktree === worktree && isAlive(r.pid),
  );
  return l ? l.pid : 0;
}
