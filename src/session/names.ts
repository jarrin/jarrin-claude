import { assertSessionName } from "./launcher.js";

/**
 * Session naming: one scheme for every session the service launches, so
 * `claudjar attach` and the web interface name them the same way.
 *
 * - The **label** is what a person types: `<project>` for a project's main
 *   checkout, `<project>/<worktree>` for one of its worktrees — unique across a
 *   machine, since project names are directory names under one `projects_dir`.
 * - The **launcher name** is what the backend sees. `/` (and `.`, `:`) are not
 *   valid there (tmux rejects them; see {@link assertSessionName}), so the label
 *   is mapped: `/` becomes `--`, any other invalid character `_`.
 */

export function sessionLabel(project: string, worktree = ""): string {
  return worktree === "" ? project : `${project}/${worktree}`;
}

export function launcherName(label: string): string {
  const mapped = label.replaceAll("/", "--").replace(/[^A-Za-z0-9_-]/g, "_");
  const name = /^[A-Za-z0-9]/.test(mapped) ? mapped : `s${mapped}`;
  assertSessionName(name);
  return name;
}

/** What a session lookup can match against: a recorded label and launcher name. */
export interface NamedSession {
  readonly label: string;
  readonly name: string;
}

/**
 * Resolve what a person typed to one session: the label first, then the
 * launcher name (what `claude agents` / `tmux ls` show). Null when neither matches.
 */
export function resolveSession<T extends NamedSession>(
  sessions: readonly T[],
  query: string,
): T | null {
  const q = query.trim();
  return (
    sessions.find((s) => s.label === q) ??
    sessions.find((s) => s.name === q) ??
    null
  );
}
