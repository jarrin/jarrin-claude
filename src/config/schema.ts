/**
 * Typed view of the CLI-relevant keys in `.claude/.jarrin.yml` (and its
 * gitignored sibling `.jarrin.local.yml`).
 *
 * The SessionStart hook consumes a subset: the three rule tiers, the command
 * quick-reference, and the scalar `backup` command. The `worktree:` block is
 * consumed by `claudjar worktree` only — never by the hook, and never written by
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
 * The `worktree:` block. Lives (by convention) in the gitignored
 * `.jarrin.local.yml`, since where worktrees land and how they bootstrap is
 * machine-specific. `dir`/`copy`/`setup` are the creation recipe; `name` is the
 * identity `claudjar worktree create` stamps into a new worktree's local file so
 * the `todo` / `staged-planning` skills can scope forge work to it.
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
  /** Worktree recipe + identity (CLI-consumed, not hook-consumed) */
  worktree: WorktreeConfig;
}

export function emptyWorktreeConfig(): WorktreeConfig {
  return { dir: "", copy: [], setup: [], name: "" };
}

export function emptyConfig(): JarrinConfig {
  return {
    rules: [],
    local: [],
    imports: [],
    commands: [],
    backup: "",
    worktree: emptyWorktreeConfig(),
  };
}
