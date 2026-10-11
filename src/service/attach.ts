import type { SessionBackend, SessionLauncher } from "../session/launcher.js";
import { resolveSession } from "../session/names.js";
import type { SessionRecord } from "./state.js";

/**
 * What `claudjar attach` works from: the sessions the service recorded, with
 * their liveness asked of the launcher at the moment of asking (the recorded
 * status is only as fresh as the last service start).
 */

export type LiveStatus = "running" | "stopped" | "unknown";

export interface AttachEntry {
  readonly record: SessionRecord;
  readonly status: LiveStatus;
}

/** Annotate records with live status: one `list()` per backend in use. */
export function attachEntries(
  records: readonly SessionRecord[],
  launcherFor: (backend: SessionBackend) => SessionLauncher,
): AttachEntry[] {
  const live = new Map<SessionBackend, Set<string> | null>();
  const names = (backend: SessionBackend): Set<string> | null => {
    if (!live.has(backend)) {
      try {
        live.set(
          backend,
          new Set(
            launcherFor(backend)
              .list()
              .map((s) => s.name),
          ),
        );
      } catch {
        live.set(backend, null);
      }
    }
    return live.get(backend) ?? null;
  };
  return [...records]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((record) => {
      const set = names(record.backend);
      const status: LiveStatus =
        set === null ? "unknown" : set.has(record.name) ? "running" : "stopped";
      return { record, status };
    });
}

export function renderAttachList(entries: readonly AttachEntry[]): string {
  if (entries.length === 0)
    return "No sessions. Open a project from the web interface to start one.\n";
  const width = Math.max(...entries.map((e) => e.record.label.length));
  return entries
    .map(
      (e) =>
        `${e.record.label.padEnd(width)}  ${e.status.padEnd(7)}  ` +
        `${e.record.backend}  ${e.record.cwd}\n`,
    )
    .join("");
}

export type AttachTarget =
  | { readonly ok: true; readonly entry: AttachEntry }
  | { readonly ok: false; readonly error: string };

/**
 * Pick the session to attach to. Unknown and stopped names fail, naming the
 * sessions that can be attached to. An `unknown` status (the backend could
 * not be listed) is let through: the attach command itself will say why.
 */
export function resolveAttach(
  entries: readonly AttachEntry[],
  query: string,
): AttachTarget {
  const attachable = entries.filter((e) => e.status !== "stopped");
  const valid =
    attachable.length > 0
      ? `Running: ${attachable.map((e) => e.record.label).join(", ")}`
      : "No session is running.";
  const hit = resolveSession(
    entries.map((e) => ({ ...e, label: e.record.label, name: e.record.name })),
    query,
  );
  if (!hit)
    return { ok: false, error: `no session named '${query.trim()}'. ${valid}` };
  if (hit.status === "stopped") {
    return {
      ok: false,
      error:
        `session '${hit.record.label}' is stopped — reopen the project to ` +
        `restart it. ${valid}`,
    };
  }
  return { ok: true, entry: { record: hit.record, status: hit.status } };
}
