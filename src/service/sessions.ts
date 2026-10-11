import type { SessionBackend, SessionLauncher } from "../session/launcher.js";
import { launcherName, sessionLabel } from "../session/names.js";
import type { ProjectState, ServiceState, SessionRecord } from "./state.js";
import { setActive } from "./state.js";

/**
 * The open / close state machine and the startup reconciliation, over the
 * service state and a session launcher (`src/session/launcher.ts`).
 *
 * - **open** marks a project active and makes sure its main-checkout session
 *   runs: a session the launcher already lists under that name is adopted, not
 *   started twice. Opening an open project whose session died restarts it.
 * - **close** stops that session (if it runs), drops its record and clears the
 *   flag. Only the main-checkout session: a worktree's session may be working a
 *   loop and is that worktree's to end.
 * - **reconcile** runs once on service start: a recorded session the launcher no
 *   longer lists is marked stopped, a listed one is re-adopted as running. The
 *   active flags are left alone — that is what survives a restart.
 *
 * A failed start or stop leaves the state untouched, so the web interface never
 * shows a project as open with no session behind it.
 */

export interface SessionDeps {
  /** Backend for new sessions. */
  readonly backend: SessionBackend;
  /** A launcher for a backend; a record keeps the backend it was started on. */
  readonly launcherFor: (backend: SessionBackend) => SessionLauncher;
  readonly now: Date;
}

export type Transition =
  | {
      readonly ok: true;
      readonly state: ServiceState;
      readonly project: ProjectState;
      /** What happened, for the log. */
      readonly note: string;
    }
  | { readonly ok: false; readonly error: string };

const message = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

function withSession(state: ServiceState, record: SessionRecord): ServiceState {
  return {
    ...state,
    sessions: [
      ...state.sessions.filter((s) => s.label !== record.label),
      record,
    ],
  };
}

export function openProject(
  state: ServiceState,
  name: string,
  deps: SessionDeps,
): Transition {
  const project = state.projects.find((p) => p.name === name);
  if (!project) return { ok: false, error: `no project named '${name}'` };

  const label = sessionLabel(name);
  const recorded = state.sessions.find((s) => s.label === label);
  const backend = recorded?.backend ?? deps.backend;
  let session: string;
  let note: string;
  try {
    session = launcherName(label);
    const launcher = deps.launcherFor(backend);
    if (launcher.list().some((s) => s.name === session)) {
      note = `adopted running session ${session}`;
    } else {
      launcher.start(session, project.path);
      note = `started session ${session} (${backend})`;
    }
  } catch (err) {
    return { ok: false, error: `cannot start a session: ${message(err)}` };
  }

  const record: SessionRecord = {
    name: session,
    label,
    project: name,
    worktree: "",
    cwd: project.path,
    backend,
    startedAt:
      recorded?.status === "running" && recorded.startedAt
        ? recorded.startedAt
        : deps.now.toISOString(),
    status: "running",
  };
  const changed = setActive(withSession(state, record), name, true, deps.now);
  if (!changed) return { ok: false, error: `no project named '${name}'` };
  return { ok: true, ...changed, note };
}

export function closeProject(
  state: ServiceState,
  name: string,
  deps: SessionDeps,
): Transition {
  if (!state.projects.some((p) => p.name === name))
    return { ok: false, error: `no project named '${name}'` };

  const label = sessionLabel(name);
  const recorded = state.sessions.find((s) => s.label === label);
  let note = "no session to stop";
  if (recorded) {
    try {
      const launcher = deps.launcherFor(recorded.backend);
      if (launcher.list().some((s) => s.name === recorded.name)) {
        launcher.stop(recorded.name);
        note = `stopped session ${recorded.name}`;
      } else {
        note = `session ${recorded.name} was not running`;
      }
    } catch (err) {
      return { ok: false, error: `cannot stop the session: ${message(err)}` };
    }
  }

  const changed = setActive(
    { ...state, sessions: state.sessions.filter((s) => s.label !== label) },
    name,
    false,
    deps.now,
  );
  if (!changed) return { ok: false, error: `no project named '${name}'` };
  return { ok: true, ...changed, note };
}

export interface Reconciled {
  readonly state: ServiceState;
  /** One line per record whose status changed, or whose backend could not be asked. */
  readonly notes: readonly string[];
}

/**
 * Bring the recorded sessions' status in line with what the launchers list. A
 * backend that cannot be listed (its binary missing, its daemon down) leaves
 * its records as they were: "unknown" is not "stopped".
 */
export function reconcileSessions(
  state: ServiceState,
  launcherFor: (backend: SessionBackend) => SessionLauncher,
): Reconciled {
  const notes: string[] = [];
  const running = new Map<SessionBackend, Set<string> | null>();
  const liveNames = (backend: SessionBackend): Set<string> | null => {
    if (!running.has(backend)) {
      try {
        const names = launcherFor(backend)
          .list()
          .map((s) => s.name);
        running.set(backend, new Set(names));
      } catch (err) {
        notes.push(`cannot list ${backend} sessions: ${message(err)}`);
        running.set(backend, null);
      }
    }
    return running.get(backend) ?? null;
  };

  const sessions = state.sessions.map((s): SessionRecord => {
    const live = liveNames(s.backend);
    if (live === null) return s;
    const status = live.has(s.name) ? "running" : "stopped";
    if (status !== s.status) {
      notes.push(
        status === "running"
          ? `session ${s.label}: re-adopted`
          : `session ${s.label}: no longer running, marked stopped`,
      );
    }
    return status === s.status ? s : { ...s, status };
  });
  return { state: { ...state, sessions }, notes };
}
