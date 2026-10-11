import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { Project } from "./discover.js";

/**
 * The service's runtime state, `~/.claudjar/service/state.json` of the user the
 * service runs as (`JARRIN_SERVICE_DIR` overrides the directory).
 *
 * The projects list is re-derived from disk on every scan; what survives a scan
 * is what disk cannot tell: whether a project is open (active) in the web
 * interface, and the background sessions the service launched for it.
 */

export const STATE_VERSION = 1;

export type SessionRecordStatus = "running" | "stopped";

export interface SessionRecord {
  /** The launcher's session name (see `src/session/launcher.ts`). */
  readonly name: string;
  /** The name people use: `<project>` or `<project>/<worktree>` (`src/session/names.ts`). */
  readonly label: string;
  readonly project: string;
  /** The worktree's name; empty for the project's main checkout. */
  readonly worktree: string;
  readonly cwd: string;
  readonly backend: "bg" | "tmux";
  readonly startedAt: string;
  /** Last known liveness; reconciled against the launcher on service start. */
  readonly status: SessionRecordStatus;
}

/**
 * A `claudjar loop` the service started in a worktree (`create-worktree`,
 * `mode: "loop"`). It runs detached in a scope of its own, so it outlives a
 * service restart; the record is what links it back to its worktree.
 */
export interface LoopRecord {
  readonly project: string;
  /** The worktree's stamped name. */
  readonly worktree: string;
  readonly cwd: string;
  readonly milestone: { readonly id: number; readonly title: string };
  readonly pid: number;
  /** Where the loop's own output goes. */
  readonly log: string;
  readonly startedAt: string;
}

export interface ProjectState {
  readonly name: string;
  readonly path: string;
  readonly configured: boolean;
  readonly backlogRepo: string;
  readonly active: boolean;
}

export interface ServiceState {
  readonly version: number;
  readonly updatedAt: string;
  readonly projects: readonly ProjectState[];
  readonly sessions: readonly SessionRecord[];
  readonly loops: readonly LoopRecord[];
}

export function serviceDir(env: NodeJS.ProcessEnv): string {
  return env.JARRIN_SERVICE_DIR ?? join(homedir(), ".claudjar", "service");
}

export function statePath(dir: string): string {
  return join(dir, "state.json");
}

export function emptyState(): ServiceState {
  return {
    version: STATE_VERSION,
    updatedAt: "",
    projects: [],
    sessions: [],
    loops: [],
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function toProjectState(v: unknown): ProjectState | null {
  if (!isRecord(v) || typeof v.name !== "string" || typeof v.path !== "string")
    return null;
  return {
    name: v.name,
    path: v.path,
    configured: v.configured === true,
    backlogRepo: typeof v.backlogRepo === "string" ? v.backlogRepo : "",
    active: v.active === true,
  };
}

function toSession(v: unknown): SessionRecord | null {
  if (
    !isRecord(v) ||
    typeof v.name !== "string" ||
    typeof v.project !== "string" ||
    typeof v.cwd !== "string" ||
    (v.backend !== "bg" && v.backend !== "tmux")
  )
    return null;
  return {
    name: v.name,
    label: typeof v.label === "string" ? v.label : v.name,
    project: v.project,
    worktree: typeof v.worktree === "string" ? v.worktree : "",
    cwd: v.cwd,
    backend: v.backend,
    startedAt: typeof v.startedAt === "string" ? v.startedAt : "",
    status: v.status === "stopped" ? "stopped" : "running",
  };
}

function toLoop(v: unknown): LoopRecord | null {
  if (
    !isRecord(v) ||
    typeof v.project !== "string" ||
    typeof v.worktree !== "string" ||
    typeof v.cwd !== "string" ||
    typeof v.pid !== "number" ||
    !isRecord(v.milestone) ||
    typeof v.milestone.id !== "number" ||
    typeof v.milestone.title !== "string"
  )
    return null;
  return {
    project: v.project,
    worktree: v.worktree,
    cwd: v.cwd,
    milestone: { id: v.milestone.id, title: v.milestone.title },
    pid: v.pid,
    log: typeof v.log === "string" ? v.log : "",
    startedAt: typeof v.startedAt === "string" ? v.startedAt : "",
  };
}

/**
 * Parse state JSON. Throws on text that is not JSON or not a state object, so a
 * corrupt file is reported rather than silently forgetting which projects were
 * open; malformed individual rows are dropped.
 */
export function parseState(text: string): ServiceState {
  const doc: unknown = JSON.parse(text);
  if (!isRecord(doc)) throw new Error("state.json is not an object");
  const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  return {
    version: typeof doc.version === "number" ? doc.version : STATE_VERSION,
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : "",
    projects: rows(doc.projects)
      .map(toProjectState)
      .filter((p): p is ProjectState => p !== null),
    sessions: rows(doc.sessions)
      .map(toSession)
      .filter((s): s is SessionRecord => s !== null),
    loops: rows(doc.loops)
      .map(toLoop)
      .filter((l): l is LoopRecord => l !== null),
  };
}

/** Read the state; a missing file is the empty state. */
export function readState(path: string): ServiceState {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT")
      return emptyState();
    throw err;
  }
  return parseState(text);
}

/** Write atomically (tmp + rename), so a crash mid-write never leaves half a file. */
export function writeState(path: string, state: ServiceState): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
}

/**
 * Fold a fresh discovery into the previous state: the project list follows disk,
 * a project's `active` flag carries over by name, and sessions are kept as-is
 * (`src/service/sessions.ts` reconciles them against the launcher).
 */
export function mergeDiscovery(
  prev: ServiceState,
  projects: readonly Project[],
  now: Date,
): ServiceState {
  const wasActive = new Set(
    prev.projects.filter((p) => p.active).map((p) => p.name),
  );
  return {
    version: STATE_VERSION,
    updatedAt: now.toISOString(),
    projects: projects.map((p) => ({ ...p, active: wasActive.has(p.name) })),
    sessions: prev.sessions,
    loops: prev.loops,
  };
}

/**
 * Open or close a project (the web interface's `open-project` / `close-project`).
 * Null when no project of that name was discovered.
 */
export function setActive(
  prev: ServiceState,
  name: string,
  active: boolean,
  now: Date,
): { readonly state: ServiceState; readonly project: ProjectState } | null {
  const project = prev.projects.find((p) => p.name === name);
  if (!project) return null;
  const next = { ...project, active };
  return {
    state: {
      ...prev,
      updatedAt: now.toISOString(),
      projects: prev.projects.map((p) => (p.name === name ? next : p)),
    },
    project: next,
  };
}
