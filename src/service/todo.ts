import type {
  ForgeEvent,
  MilestoneRef,
  WorktreeDetail,
} from "../../monitor/shared/protocol.js";
import type { Issue, MilestoneCounts } from "../loop/gitea.js";
import { sessionLabel } from "../session/names.js";
import type { CreateOptions, CreateResult } from "../worktree/lib.js";
import type { LoopRecord, ProjectState, ServiceState } from "./state.js";
import type { LoopSpec } from "./worktrees.js";

/**
 * The todo watcher: every open project gets a `todo` milestone in its backlog
 * repo and, once a ticket lands there, a `todo` worktree with a `claudjar loop`
 * on that milestone. The loop already gives each ticket a fresh session and
 * closes it when done; the watcher only decides when a loop should run and
 * when the worktree's stack may go down.
 *
 * - A tick runs on every rescan and on a forge event (a Gitea webhook relayed
 *   by the monitor) for the project's backlog repo. Only events that can add
 *   work ({@link pokesTodo}) count as a poke.
 * - With open tickets and no live loop, the stack is started and a loop is
 *   spawned — but only for something new: a ticket the last loop never saw, or
 *   a forge event since. Tickets a loop left open (blocked) are not retried on
 *   every rescan.
 * - With nothing to do for {@link TODO_IDLE_MS}, the stack is stopped. The next
 *   ticket starts it again.
 *
 * Pure over {@link TodoDeps}; the per-project {@link TodoMemory} lives in the
 * service's memory only, so a restart re-checks every project once.
 */

export const TODO_NAME = "todo";
export const TODO_IDLE_MS = 15 * 60_000;

const TODO_DESCRIPTION =
  "Single-run instructions for claudjar: each open ticket here is worked in " +
  "the `todo` worktree, in a fresh session, and closed when done.";

export interface TodoMemory {
  /** Whether the stack may be running; true until a teardown says otherwise. */
  readonly stackUp: boolean;
  /** Since when nothing was left to do; null while busy. */
  readonly idleSince: number | null;
  /** The open tickets when the last loop started; null before the first. */
  readonly seen: readonly number[] | null;
  /** A forge event arrived since the last loop started. */
  readonly poked: boolean;
}

export const freshMemory: TodoMemory = {
  stackUp: true,
  idleSince: null,
  seen: null,
  poked: false,
};

export interface TodoDeps {
  readonly milestones: (repo: string) => Promise<MilestoneCounts[]>;
  readonly createMilestone: (
    repo: string,
    title: string,
    description: string,
  ) => Promise<MilestoneRef>;
  readonly openIssues: (
    repo: string,
    milestone: MilestoneRef,
  ) => Promise<Issue[]>;
  readonly checkouts: (project: ProjectState) => readonly WorktreeDetail[];
  readonly create: (
    repoRoot: string,
    opts: CreateOptions,
  ) => Promise<CreateResult>;
  /** Run the worktree's stack command; an error message, or null when it ran (or there is none). */
  readonly stack: (
    cwd: string,
    which: "start" | "exit",
  ) => Promise<string | null>;
  readonly startLoop: (
    spec: LoopSpec,
  ) => Promise<{ readonly pid: number; readonly log: string }>;
  /** The pid of a live loop holding `milestoneId`'s lock in `repo`, or null. */
  readonly loopHolder: (repo: string, milestoneId: number) => number | null;
  readonly isAlive: (pid: number) => boolean;
  readonly now: () => number;
}

export interface TodoTick {
  readonly memory: TodoMemory;
  /** A loop the tick started, to record in the state. */
  readonly loop: LoopRecord | null;
  /** What happened, for the log; empty when nothing did. */
  readonly notes: readonly string[];
}

const message = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/**
 * The webhook actions that can bring work to the todo milestone: a ticket
 * filed, reopened, or moved into it. Anything else — above all the loop's own
 * comments, labels and closes — must not count as a poke, or a ticket the loop
 * left blocked would be restarted by the comment saying it is blocked.
 */
const WORK_ACTIONS = new Set(["opened", "reopened", "milestoned"]);

export function pokesTodo(event: ForgeEvent): boolean {
  return WORK_ACTIONS.has(event.action);
}

/** Whether the open tickets hold something the last loop has not been given. */
export function hasNewWork(
  open: readonly Issue[],
  memory: TodoMemory,
): boolean {
  if (open.length === 0) return false;
  const { seen } = memory;
  if (memory.poked || seen === null) return true;
  return open.some((i) => !seen.includes(i.number));
}

export async function tickTodo(
  state: ServiceState,
  project: ProjectState,
  memory: TodoMemory,
  deps: TodoDeps,
): Promise<TodoTick> {
  const repo = project.backlogRepo;
  const notes: string[] = [];
  const done = (m: TodoMemory, loop: LoopRecord | null = null): TodoTick => ({
    memory: m,
    loop,
    notes,
  });

  let milestone: MilestoneRef | undefined = (await deps.milestones(repo)).find(
    (m) => m.title === TODO_NAME,
  );
  if (!milestone) {
    milestone = await deps.createMilestone(repo, TODO_NAME, TODO_DESCRIPTION);
    notes.push(`created milestone "${TODO_NAME}" in ${repo}`);
  }

  const recorded = state.loops.find(
    (l) =>
      l.project === project.name &&
      l.milestone.id === milestone.id &&
      deps.isAlive(l.pid),
  );
  if (recorded || deps.loopHolder(repo, milestone.id) !== null)
    return done({ ...memory, idleSince: null });

  const open = await deps.openIssues(repo, milestone);
  const checkout = deps.checkouts(project).find((w) => w.name === TODO_NAME);

  if (!hasNewWork(open, memory)) {
    const now = deps.now();
    const idleSince = memory.idleSince ?? now;
    if (!memory.stackUp || !checkout || now - idleSince < TODO_IDLE_MS)
      return done({ ...memory, idleSince });
    const err = await deps.stack(checkout.path, "exit");
    notes.push(
      err
        ? `todo stack of ${project.name} did not stop: ${err}`
        : `todo stack of ${project.name} stopped (idle)`,
    );
    return done({ ...memory, idleSince, stackUp: Boolean(err) });
  }

  let path = checkout?.path;
  let worktree = checkout?.name ?? TODO_NAME;
  if (!path) {
    const made = await deps.create(project.path, {
      name: TODO_NAME,
      milestone: TODO_NAME,
    });
    if (!made.ok) {
      notes.push(`todo worktree of ${project.name} not created: ${made.error}`);
      return done({ ...memory, poked: true });
    }
    path = made.path;
    worktree = made.name;
    notes.push(`created worktree ${made.name} at ${made.path}`);
  }

  const stackErr = await deps.stack(path, "start");
  if (stackErr) {
    notes.push(`todo stack of ${project.name} did not start: ${stackErr}`);
    return done({ ...memory, poked: true });
  }

  try {
    const started = await deps.startLoop({
      cwd: path,
      repo,
      milestone: { id: milestone.id, title: milestone.title },
      label: sessionLabel(project.name, worktree),
    });
    notes.push(
      `todo loop for ${project.name}: ${String(open.length)} ticket(s), pid ${String(started.pid)}`,
    );
    return done(
      {
        stackUp: true,
        idleSince: null,
        seen: open.map((i) => i.number),
        poked: false,
      },
      {
        project: project.name,
        worktree,
        cwd: path,
        milestone: { id: milestone.id, title: milestone.title },
        pid: started.pid,
        log: started.log,
        startedAt: new Date(deps.now()).toISOString(),
      },
    );
  } catch (err) {
    notes.push(`todo loop for ${project.name} did not start: ${message(err)}`);
    return done({ ...memory, stackUp: true, poked: true });
  }
}
