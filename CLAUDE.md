# jarrin-claude — repository guide

This repo is the version-controlled source for Jarrin's global Claude Code config; the
files under `claude/` are symlinked into `~/.claude/`. This document governs **how to
author rule files** in this repo. Jarrin's leading working preferences in
`claude/CLAUDE.md` still apply on top of everything here.

## Git workflow

Commit directly to `main` in this repo — do not create feature branches or open PRs for
routine changes. Push only when explicitly asked.

## Where rules live

- Global rule library: `claude/rules/*.md`, symlinked to `~/.claude/rules/`.
- One file per language or framework, named by slug: `lang-php.md`, `lang-ts.md`,
  `fw-laravel.md`, `fw-nuxtjs.md`, … (referenced without the `.md`).
- All content in **English**, imperative and terse — rules load into a live context
  window, so every line must earn its place.

## Where shared references live

A doc that **more than one skill** reads goes in `claude/references/*.md`, symlinked to
`~/.claude/references/`; skills cite it by that absolute path. Keeping it out of any one
skill's `references/` avoids an arbitrary owner (and a second skill reaching into the
first one's directory). A doc only one skill reads stays in that skill's own
`references/`, per `add-skill`.

Not a skill directory: `claude/references/` holds plain Markdown with no `SKILL.md` and
is never auto-loaded — it costs nothing until a skill reads it. `claude/references/backlog.md`
is the shared contract behind the `backlog:` block (below), implemented by both
`staged-planning` and `todo`.

## How rules are selected (per project)

Rules are **not** auto-loaded by path globbing. Each project opts in explicitly, and a
`SessionStart` hook (`bin/claude/session-start` — a launcher for the `claudjar` Node
bundle, symlinked to `~/.claude/bin/`; needs Node on PATH) injects the selected rules at
the start of every session. The `claudjar init` command scaffolds and updates a repo's
`.jarrin.yml`; see the README's **The claudjar CLI** section.

- **`<project>/.claude/.jarrin.yml`** (required to activate) selects rules from three
  tiers and, optionally, declares a command quick-reference. All keys are optional; an
  empty file injects nothing (not an error):

  ```yaml
  # Tier a — global rule slugs → ~/.claude/rules/<slug>.md
  rules:
    - lang-php
    - fw-laravel

  # Tier b — project-local rule files committed in this repo (paths from the repo root)
  local:
    - .claude/rules/some-local-rule.md

  # Tier c — cross-repo imports: an owner repo + a rule it owns. Resolved under the
  # group root (the parent of the repo's directory):
  #   <group-root>/<owner>/.claude/rules/<rule>.md
  imports:
    - owner: server
      rule: prdl-data-types

  # Dev-command quick reference, rendered as a table
  commands:
    - cmd: prdl deploy
      desc: ship to production

  # Shell command run to back up the repo before a new session / clear
  backup: git bundle create ../jarrin-claude.bundle --all
  ```

  Load order is global → local → imports; each rule body is included once (duplicates
  are de-duplicated: `rules` by slug, `imports` by owner+rule). Missing rule files are
  warned about and skipped; a missing `.jarrin.yml` is an error (surfaced on stderr).
  The hook parses `.jarrin.yml` with a real YAML library (the `yaml` package) — any valid
  YAML shape works — but only _consumes_ the four rule/command tiers plus `backup:` and
  ignores every other top-level key. Unknown top-level keys are silently ignored. Override
  the group root with `JARRIN_GROUP_ROOT` and the library location with
  `JARRIN_RULES_DIR` (both for testing).

  The optional **`backup:`** key is a single shell command the hook runs _before_ the
  session loads, so a repo can snapshot itself before a new conversation. Unlike
  `backlog:`, it **is hook-consumed**. It is kept a one-line scalar by convention (the
  parser could nest, but a scalar is the simplest form for a single command).
  It runs only for the `startup` and `clear` session sources (a genuinely new session
  and `/clear`); `resume` and `compact` skip it. A failed backup is **fatal**: the hook
  exits non-zero and injects no context, so the session does not start without its
  safety net. The command's own output is relayed to stderr — never stdout, which
  carries the hook's JSON.

- **`<project>/.claude/.jarrin-claude.md`** (optional) is appended verbatim after
  everything above. This is the home for the repo's **always-apply project
  instructions** — its hard rules and "Start here" orientation prose (there is no
  structured `start:` key; write it here as prose). Silently ignored when absent.

- A **`backlog:`** block in `.jarrin.yml` selects — per repo, and independently for plans
  and todos — whether work is tracked as **local files** (the default) or as **issues on a
  git forge** grouped by milestone. It replaces the retired `todo:` block:

  ```yaml
  backlog:
    repo: owner/name # home repo for the forge methods; default for both sections
    plan:
      method: local # local (alias: repo) | gitea | github | gitlab (default: local)
      assignee: claude # forge methods only
      repo: owner/name # optional per-section override of backlog.repo
      dir: .claude/plans # local method only (default: .claude/plans)
    todo:
      method: gitea
      assignee: claude
      dir: .claude/todo # local method only (default: .claude/todo)
  ```

  `staged-planning` reads `backlog.plan`; `todo` reads `backlog.todo`. Both sections
  default to `method: local`, and a missing `backlog:` block means local for both — so a
  repo that never declares one behaves exactly as it did before `backlog:` existed.
  How both skills resolve this config and drive a forge — labels, milestones, ticket
  bodies, retrieval, and the silent API traps — is specified once in
  `claude/references/backlog.md`; change the behaviour there, not in a skill.

  **The hook does not read this block — by design, not by limitation.** `backlog:` is
  skill-consumed. The hook now uses a real YAML parser, so it _could_ read nested keys,
  but it deliberately ignores everything except the four rule/command tiers and `backup:`
  — `backlog:` is owned by the `staged-planning` and `todo` skills, which parse it
  themselves. A Vitest test pins the invariant: a nested `backlog:` block must never
  corrupt `rules` / `local` / `imports` / `commands`.

- A **`worktree:`** block configures `claudjar worktree create <name>` — how a new git
  worktree for this repo is placed and bootstrapped. It is **CLI-consumed only** (never the
  hook, never `init`), and lives by convention in the gitignored **`.jarrin.local.yml`**
  (below), since where worktrees land and how they build is machine-specific:

  ```yaml
  worktree:
    dir: ../ # base for new worktrees, relative to the repo root; unset →
    #        grouped-sibling default <parent>/<repo>-worktrees/<name>
    copy: # gitignored files carried into a new worktree (always incl. .jarrin.local.yml)
      - .env
      - .claude/settings.local.json
    setup: # shell commands run in the new worktree after creation, in order
      - poetry install
      - docker compose up -d
    name: feature-x # identity marker — stamped by `worktree create`, not hand-set
  ```

  `create` runs `git worktree add` (new branch unless it exists), copies the `copy:` files
  across, **stamps `worktree.name`** into the new worktree's `.jarrin.local.yml`, then runs
  `setup:` in order (stopping on the first failure; `--no-setup` skips them). That stamped
  `name` is what the `staged-planning` and `todo` skills read to scope forge tickets to the
  worktree (`worktree/<name>` label; see `claude/references/backlog.md` §9).

- **`<project>/.claude/.jarrin.local.yml`** (optional, **gitignored**) is a per-machine
  override merged over the committed `.jarrin.yml`. **Only the `worktree:` block is
  overridable** — every other key is taken from the committed base verbatim (declaring
  `rules` / `commands` / `backup` here has no effect; that is deliberate, they are shared
  config). Widen the override surface explicitly in `src/config/merge.ts` if a future key
  needs it. The merge is CLI-only: the SessionStart hook reads the committed base alone, so
  the hot path never touches the local file.

`claudjar info` prints the merged, resolved view of all of the above for the current repo:
config files present, rules with on-disk presence, the command table, backlog methods,
worktree config, backup, and available skills.

This gives explicit, per-repo control that path globs cannot express (e.g. "this Laravel
app uses React Native — never Expo"): the project lists the exact rules it wants, its own
in-repo rules, and the shared rules it imports from sibling repos in the same group.

The hook and CLI are covered by colocated Vitest tests under `src/` (`*.test.ts`): the
three tiers, dedup, missing-file behaviour, `commands` rendering, the nested-`backlog:`
non-corruption invariant, the `worktree:`-only local-override merge, worktree planning /
name stamping, `info` rendering, config read/write round-trips, and the `--no-interaction`
detection matrix. They run in the pre-commit hook via `pnpm check`.

## Rule file format

Each rule is plain Markdown. Frontmatter is **not** required — the loader selects rules
by filename, not by `paths:` globs.

```markdown
# PHP

- …bullets…
```

- Don't restate the global preferences from `claude/CLAUDE.md`; add only the
  language- or framework-specific specifics.

## Required sections for a language / ecosystem rule

Every language rule must cover these five sections, in this order. Each is a short,
enforceable bullet list — name the concrete tool and command, not vague advice.

### Tooling

- Name the standard package manager and forbid the non-standard one
  (`poetry` not `pip`, `pnpm` not `npm`, plus `composer`, `cargo`, …).
- Packages are added / updated / removed via that tool only — never by hand-editing the
  manifest.
- Pin the toolchain / runtime version where the ecosystem supports it.

### Testing

- Name the test runner and the command to run the suite (`pytest`, `vitest`, `phpunit`).
- Default to **unit tests**; add e2e only when explicitly requested.
- State where tests live and that new code ships with tests.

### Linting

- Name the linter / formatter and the exact commands (`ruff check` + `ruff format`,
  `eslint` + `prettier`, `php-cs-fixer`).
- Lint must pass clean — no disabled rules without a written reason.

### Enforcing (via git)

- Wire tooling, tests, linting, and type-checking into a **pre-commit hook** (and/or CI)
  so they run automatically and **block a commit / PR on failure**. Never rely on people
  remembering to run checks.
- Projects enable hooks via `git config core.hooksPath .githooks` (as this repo does);
  add checks under `.githooks/`.
- Secret scanning (gitleaks) is already enforced here — keep it.

### Strong typing

- Require full type coverage and a type checker in pre-commit / CI
  (`mypy` or `pyright`, `tsc --noEmit`, `phpstan` at max level).
- Forbid loosely-typed escape hatches (`any`, `@ts-ignore`, `# type: ignore`, `mixed`)
  unless justified in an inline comment.
- TypeScript over plain JavaScript, always.

## Precedence

`claude/CLAUDE.md` (global preferences) always applies. On top of it, the `SessionStart`
hook injects the rules named in the project's `.claude/.jarrin.yml`, followed by the
project's `.claude/.jarrin-claude.md`. More specific (project) instructions win over the
global baseline.
