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
 * The `project.dist:` block — the release surface. `version` is the **source of
 * truth** for the project's released version: `claudjar release` reads it, bumps
 * it, and writes it back. `sync` lists the other files that carry the same
 * version and must be rewritten in step (package.json, pyproject.toml, .env, …);
 * each path is repo-relative and dispatched by filename — see `src/release/sync.ts`.
 */
export interface DistConfig {
  /** Current released version, `major.minor.patch`; "" when never released. */
  version: string;
  /** Repo-relative files whose version is rewritten on release. */
  sync: string[];
}

/**
 * The `project:` block (committed to `.jarrin.yml`, shared like the rule tiers).
 * Declares the per-worktree runtime stack: a starting `port` that worktrees
 * increment from, and the `start`/`exit` commands `claudjar start` / `stop` run
 * to bring the stack up and down. The assigned port is exposed to those commands
 * as the `PROJECT_PORT` environment variable.
 *
 * `commands.build` is not part of the stack lifecycle — it is the build
 * `claudjar release` runs after bumping the version, so the artifact it tags
 * carries the new number.
 */
export interface ProjectConfig {
  /**
   * Project identity, and the last DNS label before `.localhost` in every route
   * `caddy:` generates (`<slug>.localhost`). "" = unset, which disables caddy
   * for this repo however `caddy.enabled` is set — a route needs a name.
   */
  slug: string;
  /** Starting port; worktrees increment from here. 0 = unset. */
  port: number;
  /** Lifecycle commands run with PROJECT_PORT in the environment. */
  commands: { start: string; exit: string; build: string };
  /** Release surface: current version + the files that mirror it. */
  dist: DistConfig;
}

/**
 * The `hooks:` block (committed to `.jarrin.yml`). Shell commands run at
 * claudjar lifecycle points, in declaration order, stopping on the first failure.
 *
 * These are distinct from `worktree.setup`: `setup` is the machine-specific
 * bootstrap recipe that lives in the gitignored local file (install deps for
 * *this* machine), while `hooks.worktree.create` is committed, shared project
 * policy that every clone runs. Both fire on create — setup first, then hooks.
 *
 * `hooks.worktree.remove` runs *after* the worktree directory is gone, so it is
 * executed from the main checkout; the retired worktree's identity is passed in
 * the environment (`WORKTREE_NAME`, `WORKTREE_PATH`, `PROJECT_PORT`).
 */
export interface WorktreeHooks {
  /** Run in the new worktree after `worktree create` finishes its setup. */
  create: string[];
  /** Run from the main checkout after `worktree remove` deletes the directory. */
  remove: string[];
}

export interface HooksConfig {
  readonly worktree: WorktreeHooks;
}

/**
 * The `caddy:` block (committed to `.jarrin.yml`, shared like `project:`).
 *
 * It is a single opt-in switch on purpose. claudjar owns exactly one side of the
 * reverse-proxy arrangement: a machine-wide caddy on host port 80 that routes
 * `*.<slug>.localhost` to each registered project's OWN caddy container over the
 * shared `claudjar` docker network. Everything inside a project — its compose
 * file, its caddy config, its service routing, and joining the `claudjar`
 * network — is the project's responsibility, and claudjar never reads or writes
 * any of it. So there is nothing else to configure here: the upstream is derived
 * by convention from the slug, and the project must answer to that name.
 */
export interface CaddyConfig {
  /** Opt in to registration with the machine-wide caddy. */
  enabled: boolean;
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
  /**
   * Override for this worktree's caddy segment — the label between the service
   * and the project slug (`<service>.<slug>.<project>.localhost`). Defaults to
   * `name`, so it only exists to shorten or disambiguate a long branch name.
   */
  slug: string;
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
  /** Per-worktree stack lifecycle + release surface (committed, shared) */
  project: ProjectConfig;
  /** Worktree recipe + identity (CLI-consumed; identity also hook-consumed) */
  worktree: WorktreeConfig;
  /** Lifecycle hook commands (committed, shared; CLI-consumed) */
  hooks: HooksConfig;
  /** Opt-in to the machine-wide caddy (committed, shared; CLI-consumed) */
  caddy: CaddyConfig;
}

export function emptyProjectConfig(): ProjectConfig {
  return {
    slug: "",
    port: 0,
    commands: { start: "", exit: "", build: "" },
    dist: { version: "", sync: [] },
  };
}

export function emptyHooksConfig(): HooksConfig {
  return { worktree: { create: [], remove: [] } };
}

export function emptyWorktreeConfig(): WorktreeConfig {
  return { dir: "", copy: [], setup: [], name: "", port: 0, slug: "" };
}

export function emptyCaddyConfig(): CaddyConfig {
  return { enabled: false };
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
    hooks: emptyHooksConfig(),
    caddy: emptyCaddyConfig(),
  };
}
