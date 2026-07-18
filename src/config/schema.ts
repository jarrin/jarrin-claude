/**
 * Typed view of the CLI-relevant keys in `.claude/.jarrin.yml` (and its
 * gitignored sibling `.jarrin.local.yml`).
 *
 * The SessionStart hook consumes a subset: the three rule tiers, the command
 * quick-reference, the scalar `backup` command, and — now — the `project:` stack
 * lifecycle plus the per-worktree identity in `worktree:`. The `worktree:`
 * creation recipe is consumed by `claudjar worktree` only, never written by
 * `init`. The skill-owned `backlog:` block is deliberately NOT modeled here — the
 * CLI never edits it, and comment-preserving writes leave it intact.
 */

export interface ImportRule {
  readonly owner: string;
  readonly rule: string;
}

export interface CommandRow {
  readonly cmd: string;
  readonly desc: string;
}

/**
 * The `project:` block (committed to `.jarrin.yml`, shared like the rule tiers).
 * Declares the per-worktree runtime stack: a starting `port` that worktrees
 * increment from, and the `start`/`exit` commands the session lifecycle hooks run
 * to bring the stack up and down. The assigned port is exposed to those commands
 * as the `PROJECT_PORT` environment variable.
 */
export interface ProjectConfig {
  /** Starting port; worktrees increment from here. 0 = unset. */
  port: number;
  /** Lifecycle commands run with PROJECT_PORT in the environment. */
  commands: { start: string; exit: string };
}

/**
 * The `worktree:` block. `dir`/`copy`/`setup` are the creation recipe and live
 * (by convention) in the gitignored `.jarrin.local.yml`, since where worktrees
 * land and how they bootstrap is machine-specific. `name` and `port` are the
 * identity `claudjar worktree create` stamps into a new worktree's local file:
 * `name` scopes forge work for the `todo` / `staged-planning` skills, and `port`
 * is this worktree's assigned `PROJECT_PORT`.
 */
export interface WorktreeConfig {
  /** Base dir for new worktrees, relative to the repo root; "" → grouped-sibling default. */
  dir: string;
  /** Gitignored files carried into a new worktree (always includes .jarrin.local.yml). */
  copy: string[];
  /** Shell commands run in a new worktree after creation, in order. */
  setup: string[];
  /** Identity of THIS worktree, stamped on create; "" for the main worktree. */
  name: string;
  /** Assigned PROJECT_PORT for THIS worktree, stamped on create; 0 for the main worktree. */
  port: number;
}

export interface JarrinConfig {
  /** Tier a — global rule slugs → ~/.claude/rules/<slug>.md */
  readonly rules: string[];
  /** Tier b — project-local rule files (paths from the repo root) */
  readonly local: string[];
  /** Tier c — cross-repo imports resolved under the group root */
  readonly imports: ImportRule[];
  /** Dev-command quick reference, rendered as a table by the hook */
  readonly commands: CommandRow[];
  /** Shell command run before a new session / clear (hook-consumed scalar) */
  backup: string;
  /** Per-worktree stack lifecycle (committed, shared; hook-consumed) */
  project: ProjectConfig;
  /** Worktree recipe + identity (CLI-consumed; identity also hook-consumed) */
  worktree: WorktreeConfig;
}

export function emptyProjectConfig(): ProjectConfig {
  return { port: 0, commands: { start: "", exit: "" } };
}

export function emptyWorktreeConfig(): WorktreeConfig {
  return { dir: "", copy: [], setup: [], name: "", port: 0 };
}

export function emptyConfig(): JarrinConfig {
  return {
    rules: [],
    local: [],
    imports: [],
    commands: [],
    backup: "",
    project: emptyProjectConfig(),
    worktree: emptyWorktreeConfig(),
  };
}
