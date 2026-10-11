import { renameSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import type { HostCommand } from "../../monitor/shared/protocol.js";
import type { SessionBackend, SessionLauncher } from "../session/launcher.js";
import type { ServiceConf } from "./conf.js";
import type { DetailDeps } from "./detail.js";
import { collectDetail } from "./detail.js";
import type { DirEntry, Project } from "./discover.js";
import { discoverProjects } from "./discover.js";
import type { CommandOutcome, HostLink } from "./link.js";
import { closeProject, openProject, reconcileSessions } from "./sessions.js";
import type { ProjectState, ServiceState } from "./state.js";
import { emptyState, mergeDiscovery, readState, writeState } from "./state.js";

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
    const detail = await collectDetail(project, state.sessions, opts.detail);
    link?.detail(detail);
    return { ok: true };
  };

  const handle = (command: HostCommand): Promise<CommandOutcome> => {
    if (command.type === "refresh-project")
      return publishDetail(command.project);
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

      if (opts.once || opts.signal.aborted) return;
      try {
        await sleep(opts.intervalMs, undefined, { signal: opts.signal });
      } catch {
        return; // aborted while sleeping
      }
    }
  }
}
