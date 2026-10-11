import type {
  HostCommand,
  MilestoneRef,
  WorktreeDetail,
} from "../../monitor/shared/protocol.js";
import { sessionLabel } from "../session/names.js";
import type {
  MergeOptions,
  MergeResult,
  RemoveOptions,
  RemoveResult,
} from "../worktree/lib.js";
import type { DetailRecords } from "./detail.js";
import type { SessionDeps } from "./sessions.js";
import type {
  LoopRecord,
  ProjectState,
  ServiceState,
  SessionRecord,
} from "./state.js";
import type { CreateDeps } from "./worktrees.js";

/**
 * What the web interface can do to a worktree once it exists: abort and
 * restart its loop (`stop-loop` / `resume-loop`), merge it back into the
 * checkout it was created from (`merge-worktree`), and tear it down
 * (`remove-worktree`, or `merge-worktree` with `remove`).
 *
 * Pure over {@link ManageDeps}. Every guard runs before anything is changed,
 * and each refusal names what to do instead:
 *
 * - a merge is refused while a loop or session runs in the worktree, or while
 *   either tree has uncommitted changes, and a conflict is aborted rather than
 *   left half-merged in a checkout nobody is standing in;
 * - a remove stops the worktree's session and loop first (the loop stashes its
 *   work on the way out), then refuses if the tree is still dirty — removing it
 *   would throw that work away. An unmerged branch survives the removal.
 */

export type ManageCommand = Extract<
  HostCommand,
  {
    readonly type:
      "stop-loop" | "resume-loop" | "merge-worktree" | "remove-worktree";
  }
>;

export interface ManageDeps {
  readonly merge: (
    repoRoot: string,
    opts: MergeOptions,
  ) => Promise<MergeResult>;
  readonly remove: (
    repoRoot: string,
    opts: RemoveOptions,
  ) => Promise<RemoveResult>;
  /** Uncommitted changes in a checkout, as `git status --porcelain` lines. */
  readonly dirty: (path: string) => readonly string[];
  /** The pid of a live loop holding the worktree lock on `path`, or null. */
  readonly worktreeLoopHolder: (repo: string, path: string) => number | null;
  readonly loopHolder: CreateDeps["loopHolder"];
  /** SIGTERM a loop and wait for it to exit; false when it did not in time. */
  readonly stopLoop: (pid: number) => Promise<boolean>;
  readonly startLoop: CreateDeps["startLoop"];
  /** The backlog repo's open milestones. */
  readonly milestones: (repo: string) => Promise<readonly MilestoneRef[]>;
  /** The project's checkouts, the main one first (`collectWorktrees`). */
  readonly checkouts: (
    project: ProjectState,
    records: DetailRecords,
  ) => readonly WorktreeDetail[];
  readonly isAlive: (pid: number) => boolean;
  readonly session: SessionDeps;
}

export type Managed =
  | {
      readonly ok: true;
      readonly state: ServiceState;
      /** What happened, for the log. */
      readonly note: string;
    }
  | { readonly ok: false; readonly error: string };

const message = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

const fail = (error: string): Managed => ({ ok: false, error });

interface Target {
  readonly project: ProjectState;
  readonly worktree: WorktreeDetail;
  readonly checkouts: readonly WorktreeDetail[];
}

/** The open project and its (non-main) worktree a command names. */
function findTarget(
  state: ServiceState,
  cmd: ManageCommand,
  deps: Pick<ManageDeps, "checkouts">,
): Target | string {
  const project = state.projects.find((p) => p.name === cmd.project);
  if (!project) return `no project named '${cmd.project}'`;
  if (!project.active) return `open project '${cmd.project}' first`;
  const checkouts = deps.checkouts(project, state);
  const worktree = checkouts.slice(1).find((w) => w.name === cmd.worktree);
  if (!worktree)
    return `project '${cmd.project}' has no worktree named '${cmd.worktree}'`;
  return { project, worktree, checkouts };
}

/**
 * The checkout a worktree was created from: the one whose stamped name is the
 * longest `<name>-` prefix of it (`create x` in `dev` made `dev-x`), else the
 * main checkout.
 */
export function parentCheckout(
  checkouts: readonly WorktreeDetail[],
  worktree: Pick<WorktreeDetail, "name">,
): WorktreeDetail | null {
  let best: WorktreeDetail | null = null;
  for (const c of checkouts.slice(1)) {
    if (!c.name || !worktree.name.startsWith(`${c.name}-`)) continue;
    if (!best || c.name.length > best.name.length) best = c;
  }
  return best ?? checkouts[0] ?? null;
}

/** The pid of a live loop working in the worktree: recorded, or by its lock. */
function liveLoop(
  state: ServiceState,
  target: Target,
  deps: Pick<ManageDeps, "isAlive" | "worktreeLoopHolder">,
): number | null {
  if (target.worktree.loopPid > 0 && deps.isAlive(target.worktree.loopPid))
    return target.worktree.loopPid;
  const recorded = state.loops.find(
    (l) =>
      l.project === target.project.name &&
      l.worktree === target.worktree.name &&
      deps.isAlive(l.pid),
  );
  if (recorded) return recorded.pid;
  return target.project.backlogRepo
    ? deps.worktreeLoopHolder(target.project.backlogRepo, target.worktree.path)
    : null;
}

/** The service's session in the worktree, when the launcher still lists it. */
function liveSession(
  state: ServiceState,
  target: Target,
  deps: Pick<ManageDeps, "session">,
): SessionRecord | string | null {
  const label = sessionLabel(target.project.name, target.worktree.name);
  const record = state.sessions.find((s) => s.label === label);
  if (!record) return null;
  try {
    const live = deps.session
      .launcherFor(record.backend)
      .list()
      .some((s) => s.name === record.name);
    return live ? record : null;
  } catch (err) {
    return `cannot tell whether session ${label} runs: ${message(err)}`;
  }
}

/** Forget a worktree's session and loop records. */
function forget(
  state: ServiceState,
  project: string,
  worktree: string,
  now: Date,
): ServiceState {
  const other = (r: { project: string; worktree: string }): boolean =>
    !(r.project === project && r.worktree === worktree);
  return {
    ...state,
    updatedAt: now.toISOString(),
    sessions: state.sessions.filter(other),
    loops: state.loops.filter(other),
  };
}

const dirtyError = (where: string, lines: readonly string[]): string =>
  `${where} has ${String(lines.length)} uncommitted change(s) ` +
  `(${lines.slice(0, 3).join(", ")}${lines.length > 3 ? ", …" : ""}) — ` +
  "commit or discard them first";

/** `stop-loop`: abort the loop working in a worktree. */
export async function stopLoopIn(
  current: () => ServiceState,
  cmd: Extract<ManageCommand, { readonly type: "stop-loop" }>,
  deps: ManageDeps,
): Promise<Managed> {
  const target = findTarget(current(), cmd, deps);
  if (typeof target === "string") return fail(target);
  const pid = liveLoop(current(), target, deps);
  if (pid === null)
    return fail(`no loop is running in worktree ${cmd.worktree}`);
  if (!(await deps.stopLoop(pid)))
    return fail(
      `loop pid ${String(pid)} was asked to stop but is still running`,
    );
  return {
    ok: true,
    state: current(),
    note: `aborted the loop in ${cmd.worktree} (pid ${String(pid)})`,
  };
}

/** `resume-loop`: start `claudjar loop` again in a worktree, on its milestone. */
export async function resumeLoopIn(
  current: () => ServiceState,
  cmd: Extract<ManageCommand, { readonly type: "resume-loop" }>,
  deps: ManageDeps,
): Promise<Managed> {
  const state = current();
  const target = findTarget(state, cmd, deps);
  if (typeof target === "string") return fail(target);
  const { project, worktree } = target;
  if (!project.backlogRepo)
    return fail(
      `project '${project.name}' has no backlog repo for a loop to work`,
    );
  if (!worktree.milestone)
    return fail(`worktree ${worktree.name} is not linked to a milestone`);

  const running = liveLoop(state, target, deps);
  if (running !== null)
    return fail(
      `a loop already runs in worktree ${worktree.name} (pid ${String(running)})`,
    );
  const session = liveSession(state, target, deps);
  if (typeof session === "string") return fail(session);
  if (session)
    return fail(
      `session ${session.label} runs in worktree ${worktree.name}; ` +
        "a loop and a session must not share a working tree",
    );

  // The record knows the milestone's id; without one (pruned on a service
  // restart, or a worktree made by hand) the stamped title is looked up.
  const recorded = state.loops.find(
    (l) =>
      l.project === project.name &&
      l.worktree === worktree.name &&
      l.milestone.title === worktree.milestone,
  );
  let milestone: MilestoneRef | null = recorded?.milestone ?? null;
  if (!milestone) {
    try {
      const open = (await deps.milestones(project.backlogRepo)).find(
        (m) => m.title === worktree.milestone,
      );
      milestone = open ? { id: open.id, title: open.title } : null;
    } catch (err) {
      return fail(`cannot read the milestones: ${message(err)}`);
    }
    if (!milestone)
      return fail(`milestone "${worktree.milestone}" is not open any more`);
  }
  const holder = deps.loopHolder(project.backlogRepo, milestone.id);
  if (holder !== null)
    return fail(
      `milestone "${milestone.title}" is already worked by a loop (pid ${String(holder)})`,
    );

  const label = sessionLabel(project.name, worktree.name);
  let started: { readonly pid: number; readonly log: string };
  try {
    started = await deps.startLoop({
      cwd: worktree.path,
      repo: project.backlogRepo,
      milestone,
      label,
    });
  } catch (err) {
    return fail(`the loop did not start: ${message(err)}`);
  }
  const loop: LoopRecord = {
    project: project.name,
    worktree: worktree.name,
    cwd: worktree.path,
    milestone: { id: milestone.id, title: milestone.title },
    pid: started.pid,
    log: started.log,
    startedAt: deps.session.now.toISOString(),
  };
  // Read again: the state may have moved on while the loop was settling.
  const after = current();
  return {
    ok: true,
    state: {
      ...after,
      updatedAt: deps.session.now.toISOString(),
      loops: [
        ...after.loops.filter(
          (l) => !(l.project === project.name && l.worktree === worktree.name),
        ),
        loop,
      ],
    },
    note: `restarted the loop in ${worktree.name} on "${milestone.title}" (pid ${String(started.pid)})`,
  };
}

/** `merge-worktree`: merge into the parent checkout; with `remove`, retire it. */
export async function mergeWorktreeIn(
  current: () => ServiceState,
  cmd: Extract<ManageCommand, { readonly type: "merge-worktree" }>,
  deps: ManageDeps,
): Promise<Managed> {
  const state = current();
  const target = findTarget(state, cmd, deps);
  if (typeof target === "string") return fail(target);
  const { project, worktree } = target;
  if (!worktree.branch)
    return fail(`worktree ${worktree.name} has no branch checked out`);

  const loop = liveLoop(state, target, deps);
  if (loop !== null)
    return fail(
      `a loop runs in worktree ${worktree.name} (pid ${String(loop)}) — abort it first`,
    );
  const session = liveSession(state, target, deps);
  if (typeof session === "string") return fail(session);
  if (session)
    return fail(
      `session ${session.label} runs in worktree ${worktree.name} — end it first ` +
        `(claudjar attach ${session.label})`,
    );

  const parent = parentCheckout(target.checkouts, worktree);
  if (!parent) return fail("cannot find the checkout to merge into");
  const into = parent.name || "the main checkout";
  const ownChanges = deps.dirty(worktree.path);
  if (ownChanges.length > 0)
    return fail(dirtyError(`worktree ${worktree.name}`, ownChanges));
  const parentChanges = deps.dirty(parent.path);
  if (parentChanges.length > 0) return fail(dirtyError(into, parentChanges));

  let res: MergeResult;
  try {
    res = await deps.merge(parent.path, {
      name: worktree.branch,
      remove: cmd.remove,
      abortOnConflict: true,
    });
  } catch (err) {
    return fail(`cannot merge: ${message(err)}`);
  }
  if (!res.ok)
    return fail(
      res.conflicts.length > 0
        ? `${res.error} Conflicted: ${res.conflicts.join(", ")}`
        : res.error,
    );

  const merged = `${worktree.branch} into ${res.into ?? into}`;
  if (!res.removal)
    return { ok: true, state: current(), note: `merged ${merged}` };
  return {
    ok: true,
    state: forget(current(), project.name, worktree.name, deps.session.now),
    note:
      `merged ${merged} and removed it` +
      (res.removal.branchKept ? " (branch kept)" : "") +
      (res.removal.hookError
        ? `; a remove hook failed: ${res.removal.hookError}`
        : ""),
  };
}

/** `remove-worktree`: stop what runs in it, tear it down, remove and forget it. */
export async function removeWorktreeIn(
  current: () => ServiceState,
  cmd: Extract<ManageCommand, { readonly type: "remove-worktree" }>,
  deps: ManageDeps,
): Promise<Managed> {
  const state = current();
  const target = findTarget(state, cmd, deps);
  if (typeof target === "string") return fail(target);
  const { project, worktree } = target;
  if (!worktree.branch)
    return fail(`worktree ${worktree.name} has no branch checked out`);

  const loop = liveLoop(state, target, deps);
  const session = liveSession(state, target, deps);
  if (typeof session === "string") return fail(session);
  // Nothing to stop: refuse a dirty tree before touching anything.
  if (loop === null && !session) {
    const changes = deps.dirty(worktree.path);
    if (changes.length > 0)
      return fail(dirtyError(`worktree ${worktree.name}`, changes));
  }

  const stopped: string[] = [];
  if (session) {
    try {
      deps.session.launcherFor(session.backend).stop(session.name);
      stopped.push(`session ${session.label}`);
    } catch (err) {
      return fail(`cannot stop session ${session.label}: ${message(err)}`);
    }
  }
  if (loop !== null) {
    if (!(await deps.stopLoop(loop)))
      return fail(
        `loop pid ${String(loop)} was asked to stop but is still running`,
      );
    stopped.push(`loop pid ${String(loop)}`);
  }
  const already = stopped.length > 0 ? ` (stopped ${stopped.join(", ")})` : "";
  // The loop stashed its work on the way out; a session may not have.
  const changes = deps.dirty(worktree.path);
  if (changes.length > 0)
    return fail(dirtyError(`worktree ${worktree.name}`, changes) + already);

  let res: RemoveResult;
  try {
    res = await deps.remove(project.path, { name: worktree.branch });
  } catch (err) {
    return fail(`cannot remove: ${message(err)}${already}`);
  }
  if (!res.ok) return fail(`${res.error}${already}`);
  return {
    ok: true,
    state: forget(current(), project.name, worktree.name, deps.session.now),
    note:
      `removed worktree ${worktree.name}${already}` +
      (res.branchKept ? "; branch kept (unmerged)" : "") +
      (res.hookError ? `; a remove hook failed: ${res.hookError}` : ""),
  };
}

/** Dispatch a worktree-management command. */
export function manage(
  current: () => ServiceState,
  cmd: ManageCommand,
  deps: ManageDeps,
): Promise<Managed> {
  switch (cmd.type) {
    case "stop-loop":
      return stopLoopIn(current, cmd, deps);
    case "resume-loop":
      return resumeLoopIn(current, cmd, deps);
    case "merge-worktree":
      return mergeWorktreeIn(current, cmd, deps);
    case "remove-worktree":
      return removeWorktreeIn(current, cmd, deps);
  }
}
