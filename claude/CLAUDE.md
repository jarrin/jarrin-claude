# Jarrin's Working Preferences (leading)

These are Jarrin's personal, machine-wide preferences. They are **leading**: they apply
to every project and repo on this machine and take precedence unless a specific project's
instructions explicitly override a given point. Apply them on every session, before
writing any code, documentation, or setting up a new project.

## General

1. All written output — code, comments, documentation, skills, README's, `CLAUDE.md`,
   `AGENT.md`, commit messages, etc. — must always be written in **English**.
2. The user may ask questions in Dutch. Always answer in **English**, and still apply
   rule 1 to everything you produce.
3. Regardless of the programming language in use:
   a. Use the language's dedicated package-manager tooling (e.g. `composer`, `pnpm`,
      `poetry`) to add, update, and remove packages.
   b. Never edit package versions directly in the manifest file (`package.json`,
      `pyproject.toml`, `composer.json`, etc.) by hand — let the tool manage them.
   c. Always use strong typing, and enforce it (no loosely-typed escape hatches).

## Starting a new project

1. Always bootstrap with industry-standard tooling — no `pip` (use `poetry`), no `npm`
   (use `pnpm`), and the equivalent standard for any other ecosystem.
2. For a language you are not already sure about, first do online research to determine
   the current best-practice tooling before choosing.
3. Always set up linters and type-checking / type-forcing (e.g. PHPStan, ruff, tsc/tsx).
4. Never plain JavaScript — always TypeScript.
5. Always add tests. Default to unit tests; do not add e2e tests unless explicitly
   requested.
6. Always do online research first to confirm the best / most modern tools for the task.
