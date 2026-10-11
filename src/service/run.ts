import { renameSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import type { ServiceConf } from "./conf.js";
import type { DirEntry, Project } from "./discover.js";
import { discoverProjects } from "./discover.js";
import type { ServiceState } from "./state.js";
import { emptyState, mergeDiscovery, readState, writeState } from "./state.js";

/**
 * The service's foreground loop: discover the projects, record them in the state
 * file, and rescan on an interval until `signal` aborts. It holds no monitor link
 * yet; that is added on top of this loop later.
 */

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
    previous = projects;

    if (opts.once || opts.signal.aborted) return;
    try {
      await sleep(opts.intervalMs, undefined, { signal: opts.signal });
    } catch {
      return; // aborted while sleeping
    }
  }
}
