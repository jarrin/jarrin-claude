import { renameSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import type { ForgeEvent, HostCommand } from "../../monitor/shared/protocol.js";
import type { SessionBackend, SessionLauncher } from "../session/launcher.js";
import type { ServiceConf } from "./conf.js";
import type { DetailDeps } from "./detail.js";
import { collectDetail, collectWorktrees } from "./detail.js";
import type { DirEntry, Project } from "./discover.js";
import { discoverProjects } from "./discover.js";
import type { CommandOutcome, HostLink } from "./link.js";
import { closeProject, openProject, reconcileSessions } from "./sessions.js";
import type { ProjectState, ServiceState } from "./state.js";
import { emptyState, mergeDiscovery, readState, writeState } from "./state.js";
import type { ManageCommand, ManageDeps } from "./manage.js";
import { manage } from "./manage.js";
import type { TodoDeps, TodoMemory } from "./todo.js";
import { freshMemory, tickTodo } from "./todo.js";
import type { CreateDeps, CreateWorktreeCommand } from "./worktrees.js";
import { createWorktreeFor, pruneLoops, withCreated } from "./worktrees.js";

/**
 * The service's foreground loop: discover the projects, record them in the state
 * file, and rescan on an interval until `signal` aborts. With a monitor link
 * (`connect`), every scan publishes the project list and the web interface's
 * commands are run against the same state.
 */

/** What the run loop hands the monitor link: the current projects, and its command handler. */
export interface LinkHandlers {
  readonly projects: () => readonly ProjectState[];
  readonly onCommand: (command: HostCommand) => Promise<CommandOutcome>;
  /** The monitor relayed a forge webhook for one of this host's backlog repos. */
  readonly onForgeEvent: (event: ForgeEvent) => void;
}

export interface RunOptions {
  readonly conf: ServiceConf;
  readonly stateFile: string;
  readonly intervalMs: number;
  /** One scan, then return. */
  readonly once: boolean;
  readonly signal: AbortSignal;
  readonly log: (line: string) => void;
  readonly scan: (projectsDir: string) => DirEntry[];
  readonly now?: () => Date;
  /** Backend for the sessions an `open-project` starts. */
  readonly backend: SessionBackend;
  readonly launcherFor: (backend: SessionBackend) => SessionLauncher;
  /** How a project's detail (milestones, worktrees) is collected for the web interface. */
  readonly detail: DetailDeps;
  /**
   * How `create-worktree` makes a worktree and starts its loop (sessions use
   * `launcherFor`), and how the worktree commands merge, remove and stop.
   */
  readonly worktrees: Omit<CreateDeps, "session" | "isAlive"> &
    Pick<
      ManageDeps,
      "merge" | "remove" | "dirty" | "worktreeLoopHolder" | "stopLoop"
    >;
  /**
   * The todo watcher's forge and stack access (see `todo.ts`); absent when the
   * host has no Gitea credentials or no monitor for its loops to report to.
   */
  readonly todo?: Pick<
    TodoDeps,
    "milestones" | "createMilestone" | "openIssues" | "stack"
  >;
  /** Dial the web interface; absent when the conf has no `monitor:`. */
  readonly connect?: (handlers: LinkHandlers) => HostLink;
}

export function describeProject(p: Project): string {
  const tags = [
    p.configured ? "claudjar" : "unconfigured",
    ...(p.backlogRepo ? [`backlog ${p.backlogRepo}`] : []),
  ];
  return `  ${p.name}  (${tags.join(", ")})`;
}

/** Names added and removed between two scans. */
export function diffProjects(
  before: readonly Project[],
  after: readonly Project[],
): { added: string[]; removed: string[] } {
  const was = new Set(before.map((p) => p.name));
  const is = new Set(after.map((p) => p.name));
  return {
    added: after.filter((p) => !was.has(p.name)).map((p) => p.name),
    removed: before.filter((p) => !is.has(p.name)).map((p) => p.name),
  };
}

/**
 * Read the state once at startup. A corrupt file is moved aside and the service
 * starts fresh: refusing to start would only crash-loop the unit, and the moved
 * file keeps what it held for a human to look at.
 */
function loadState(file: string, log: (line: string) => void): ServiceState {
  try {
    return readState(file);
  } catch (err) {
    const aside = `${file}.corrupt`;
    renameSync(file, aside);
    log(
      `state unreadable (${err instanceof Error ? err.message : String(err)}); ` +
        `moved to ${aside}, starting fresh`,
    );
    return emptyState();
  }
}

export async function runService(opts: RunOptions): Promise<void> {
  const now = opts.now ?? ((): Date => new Date());
  const { conf, log } = opts;
  log(
    `claudjar service: user ${conf.user}, projects in ${conf.projectsDir}, ` +
      `state ${opts.stateFile}`,
  );

  let state = loadState(opts.stateFile, log);
  let previous: Project[] | null = null;

  // Re-adopt what survived the restart before anything can act on it.
  const reconciled = reconcileSessions(state, opts.launcherFor);
  state = reconciled.state;
  for (const note of reconciled.notes) log(note);
  const pruned = pruneLoops(state, opts.detail.isAlive);
  state = pruned.state;
  for (const note of pruned.notes) log(note);
  const running = state.sessions.filter((s) => s.status === "running");
  if (running.length > 0)
    log(
      `${String(running.length)} session(s) running: ${running.map((s) => s.label).join(", ")}`,
    );

  // Commands and scans share `state`; both run on this one event loop, and
  // neither awaits between reading and writing it, so they cannot interleave.
  // The launcher is synchronous for the same reason (a `claude --bg` returns
  // once the daemon has the session, in about a second).
  /** Collect a project's detail and publish it; reading `state` only, so it may await. */
  const publishDetail = async (name: string): Promise<CommandOutcome> => {
    const project = state.projects.find((p) => p.name === name);
    if (!project) return { ok: false, error: `no project named '${name}'` };
    const detail = await collectDetail(project, state, opts.detail);
    link?.detail(detail);
    return { ok: true };
  };

  /**
   * Create a worktree and start its loop or session. It awaits the worktree's
   * setup, so `state` is re-read after it rather than captured before.
   */
  const createWorktree = async (
    command: CreateWorktreeCommand,
  ): Promise<CommandOutcome> => {
    const what = `create-worktree ${command.project}`;
    log(
      `${what}: ${command.mode}${command.milestone ? ` on "${command.milestone.title}"` : ""}…`,
    );
    const res = await createWorktreeFor(() => state, command, {
      ...opts.worktrees,
      isAlive: opts.detail.isAlive,
      session: {
        backend: opts.backend,
        launcherFor: opts.launcherFor,
        now: now(),
      },
    });
    if (res.ok) {
      state = withCreated(state, res, now());
      writeState(opts.stateFile, state);
    }
    log(`${what}: ${res.ok ? res.note : res.error}`);
    // Even a failure may have left a worktree behind: show what is there.
    void publishDetail(command.project).catch((err: unknown) => {
      log(
        `detail ${command.project}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    return res.ok ? { ok: true } : res;
  };

  /**
   * Stop / restart a worktree's loop, merge it back, or remove it. These await
   * (a loop's settle time, hooks, the stack teardown), so `state` is read
   * through a getter and the result's state is folded in afterwards.
   */
  const manageWorktree = async (
    command: ManageCommand,
  ): Promise<CommandOutcome> => {
    const what = `${command.type} ${command.project}/${command.worktree}`;
    log(`${what}…`);
    const forge = opts.detail.forge;
    const res = await manage(() => state, command, {
      ...opts.worktrees,
      isAlive: opts.detail.isAlive,
      checkouts: (project, records) =>
        collectWorktrees(project, records, opts.detail),
      milestones: async (repo) => {
        if (!forge) throw new Error("no Gitea credentials on the host");
        return forge(repo).openMilestones();
      },
      session: {
        backend: opts.backend,
        launcherFor: opts.launcherFor,
        now: now(),
      },
    });
    if (res.ok) {
      state = res.state;
      writeState(opts.stateFile, state);
    }
    log(`${what}: ${res.ok ? res.note : res.error}`);
    void publishDetail(command.project).catch((err: unknown) => {
      log(
        `detail ${command.project}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    return res.ok ? { ok: true } : res;
  };

  /** Per-project todo watcher memory, and the projects with a tick in flight. */
  const todoMemory = new Map<string, TodoMemory>();
  const todoBusy = new Set<string>();
  /** Pokes that arrived mid-tick; each gets one more tick once it ends. */
  const todoPending = new Set<string>();

  /**
   * One todo tick for an open project with a backlog repo. A tick may create a
   * worktree (minutes), so one already in flight is not doubled: a poke during
   * it runs another tick once it ends.
   */
  const runTodo = (name: string, poke = false): void => {
    const todo = opts.todo;
    if (!todo) return;
    const project = state.projects.find((p) => p.name === name);
    if (!project?.active || !project.backlogRepo) return;
    if (todoBusy.has(name)) {
      if (poke) todoPending.add(name);
      return;
    }
    const memory = todoMemory.get(name) ?? freshMemory;
    if (poke) todoMemory.set(name, { ...memory, poked: true });
    todoBusy.add(name);
    void tickTodo(state, project, todoMemory.get(name) ?? freshMemory, {
      ...todo,
      checkouts: (p) => collectWorktrees(p, state, opts.detail),
      create: opts.worktrees.create,
      startLoop: opts.worktrees.startLoop,
      loopHolder: opts.worktrees.loopHolder,
      isAlive: opts.detail.isAlive,
      now: () => now().getTime(),
    })
      .then((tick) => {
        todoMemory.set(name, tick.memory);
        for (const note of tick.notes) log(note);
        const { loop } = tick;
        if (loop) {
          state = {
            ...state,
            updatedAt: now().toISOString(),
            loops: [
              ...state.loops.filter(
                (l) =>
                  !(l.project === loop.project && l.worktree === loop.worktree),
              ),
              loop,
            ],
          };
          writeState(opts.stateFile, state);
        }
        if (tick.notes.length > 0) return publishDetail(name);
        return undefined;
      })
      .catch((err: unknown) => {
        log(
          `todo ${name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      })
      .finally(() => {
        todoBusy.delete(name);
        if (todoPending.delete(name)) runTodo(name, true);
      });
  };

  /** A webhook for `event.repo`: tick every open project whose backlog it is. */
  const onForgeEvent = (event: ForgeEvent): void => {
    const repo = event.repo.toLowerCase();
    for (const p of state.projects)
      if (p.active && p.backlogRepo.toLowerCase() === repo) {
        log(`forge event ${event.event}/${event.action} for ${p.name}`);
        runTodo(p.name, true);
      }
  };

  const handle = (command: HostCommand): Promise<CommandOutcome> => {
    if (command.type === "refresh-project")
      return publishDetail(command.project);
    if (command.type === "create-worktree") return createWorktree(command);
    if (
      command.type === "stop-loop" ||
      command.type === "resume-loop" ||
      command.type === "merge-worktree" ||
      command.type === "remove-worktree"
    )
      return manageWorktree(command);
    const open = command.type === "open-project";
    const deps = {
      backend: opts.backend,
      launcherFor: opts.launcherFor,
      now: now(),
    };
    const res = open
      ? openProject(state, command.project, deps)
      : closeProject(state, command.project, deps);
    if (!res.ok) {
      log(`${command.type} ${command.project}: ${res.error}`);
      return Promise.resolve(res);
    }
    state = res.state;
    writeState(opts.stateFile, state);
    log(
      `project ${open ? "opened" : "closed"}: ${command.project} (${res.note})`,
    );
    link?.projectState(res.project);
    if (open) runTodo(command.project);
    // The tab opens on the project-state; its content follows once collected.
    if (open)
      void publishDetail(command.project).catch((err: unknown) => {
        log(
          `detail ${command.project}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    return Promise.resolve({ ok: true });
  };
  const link = opts.connect?.({
    projects: () => state.projects,
    onCommand: handle,
    onForgeEvent,
  });

  try {
    await scanLoop();
  } finally {
    link?.close();
  }

  async function scanLoop(): Promise<void> {
    for (;;) {
      let projects: Project[];
      try {
        projects = discoverProjects(opts.scan(conf.projectsDir));
      } catch (err) {
        // A projects dir that vanished mid-run (an unmounted disk) is logged and
        // retried, not fatal: the unit would only restart into the same state.
        log(`scan failed: ${err instanceof Error ? err.message : String(err)}`);
        projects = previous ?? [];
      }

      if (previous === null) {
        log(`${String(projects.length)} project(s):`);
        for (const p of projects) log(describeProject(p));
      } else {
        const { added, removed } = diffProjects(previous, projects);
        for (const name of added) log(`project added: ${name}`);
        for (const name of removed) log(`project removed: ${name}`);
      }
      state = mergeDiscovery(state, projects, now());
      writeState(opts.stateFile, state);
      link?.publish(state.projects);
      previous = projects;
      if (!opts.once) for (const p of state.projects) runTodo(p.name);

      if (opts.once || opts.signal.aborted) return;
      try {
        await sleep(opts.intervalMs, undefined, { signal: opts.signal });
      } catch {
        return; // aborted while sleeping
      }
    }
  }
}
