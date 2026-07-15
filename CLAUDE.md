# jarrin-claude — repository guide

This repo is the version-controlled source for Jarrin's global Claude Code config; the
files under `claude/` are symlinked into `~/.claude/`. This document governs **how to
author rule files** in this repo. Jarrin's leading working preferences in
`claude/CLAUDE.md` still apply on top of everything here.

## Where rules live

- Global rule library: `claude/rules/*.md`, symlinked to `~/.claude/rules/`.
- One file per language or framework, named by slug: `lang-php.md`, `lang-ts.md`,
  `fw-laravel.md`, `fw-nuxtjs.md`, … (referenced without the `.md`).
- All content in **English**, imperative and terse — rules load into a live context
  window, so every line must earn its place.

## How rules are selected (per project)

Rules are **not** auto-loaded by path globbing. Each project opts in explicitly, and a
`SessionStart` hook (`bin/claude/session-start`, symlinked to `~/.claude/bin/`) injects
the selected rules at the start of every session:

- **`<project>/.claude/.jarrin.yml`** (required to activate) lists the rule slugs to
  load:

  ```yaml
  rules:
    - lang-php
    - fw-laravel
  ```

  Each slug maps to `~/.claude/rules/<slug>.md`. Missing rule files are warned about and
  skipped; a missing `.jarrin.yml` is an error (surfaced on stderr).

- **`<project>/.claude/.jarrin-claude.md`** (optional) is appended verbatim for
  project-specific instructions. Silently ignored when absent.

This gives explicit, per-repo control that path globs cannot express (e.g. "this Laravel
app uses React Native — never Expo"): the project simply lists the exact rules it wants.

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
