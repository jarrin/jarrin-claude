# Jarrin's Working Preferences (leading)

These are Jarrin's personal, machine-wide preferences. They are **leading**: they apply
to every project and repo on this machine and take precedence unless a specific project's
instructions explicitly override a given point. Apply them on every session, before
writing any code, documentation, or setting up a new project.

## This machine's Claude config (jarrin-claude)

This config is managed by the **jarrin-claude** repo (source for everything symlinked into
`~/.claude/`). A globally-registered `SessionStart` hook runs in **every** repo, but only
injects rules, a command table, and project instructions for a repo that has opted in with
`.claude/.jarrin.yml`. A repo without that file starts normally but loads no project rules.

- **Activate a repo:** run `claudjar init` in it to scaffold/update `.claude/.jarrin.yml`
  (selects global rule slugs, in-repo rules, cross-repo imports, a command table, and an
  optional `backup:` / `backlog:` block). Add always-apply prose in `.claude/.jarrin-claude.md`.
- **Schema & internals:** `~/.claude/rules/` holds the global rule library; the full schema
  and authoring guide live in the jarrin-claude repo's `CLAUDE.md` and `README.md`.
- Editing config? Change the canonical files in the jarrin-claude repo, not the `~/.claude/`
  symlinks.

## General

1. All written output — code, comments, documentation, skills, README's, `CLAUDE.md`,
   `AGENT.md`, commit messages, etc. — must always be written in **English**.
2. The user may ask questions in Dutch. Always answer in **English**, and still apply
   rule 1 to everything you produce.
3. Regardless of the programming language in use:
   a. Use the language's dedicated package-manager tooling to add, update, and remove
      packages.
   b. Never edit package versions directly in the manifest file by hand — let the tool
      manage them.
   c. Always use strong typing, and enforce it (no loosely-typed escape hatches).

## Persisting instructions ("instruct yourself to …")

When Jarrin says **"instruct yourself to …"** — or otherwise asks for a preference, correction, or
working rule to be remembered — persist it to a **version-controlled file in a repo**. Never write
it to host-side, outside-repo storage (`~/.claude/projects/*/memory/`, auto-memory, or any
untracked location under `~/.claude/`): that is invisible to git, unreviewable, unshareable between
machines, and silently diverges from the repo it describes.

Where it goes depends on scope:

| Scope | File |
| --- | --- |
| General / machine-wide — applies to every repo | **this file** (`claude/CLAUDE.md` in jarrin-claude) |
| Specific to one repo | that repo's `.claude/.jarrin-claude.md` |
| A reusable stack convention (a language or framework) | the matching `claude/rules/<slug>.md` in jarrin-claude |

Edit the canonical files in the jarrin-claude repo, never the `~/.claude/` symlinks. Editing that
repo for this purpose is pre-authorised — make the edit, then say what changed and where. If an
instruction has already been written to host memory, move it into the right file above and delete
the host copy; do not leave the same rule in two places.

## Committing

- **"Commit" means the whole working tree.** Stage everything (`git add -A`), not only the files
  changed during the current session — a commit should represent the repo's state, not the
  assistant's share of it. Read `git status` / `git diff --stat` first and write a message that
  describes everything actually going in.
- **Inspect the sweep and warn first** if it contains anything stray, large, or unintentional, and
  wait for confirmation instead of committing and reporting afterwards: secrets or credentials
  (`.env`, keys, tokens); files that should be ignored (build output, `node_modules`, caches,
  logs, editor/OS cruft); large or binary blobs; unusually big diffs that don't match the stated
  intent; unrelated WIP in parts of the repo the task never touched; codegen output that drifted
  without its source changing; or deletions that look unintended. A clean, expected sweep needs no
  round-trip — commit it and say what went in.
- Never bypass a pre-commit hook (`--no-verify`) to get a commit through. If the gate fails on a
  pre-existing change, report it.

## Starting a new project

1. Always bootstrap with the ecosystem's industry-standard tooling — never a deprecated
   or non-standard alternative when a de-facto standard exists.
2. For a language you are not already sure about, first do online research to determine
   the current best-practice tooling before choosing.
3. Always set up linters and type-checking / type-forcing.
4. Where a language offers a typed variant or mode, always choose it over the untyped one.
5. Always add tests. Default to unit tests; do not add e2e tests unless explicitly
   requested.
6. Always do online research first to confirm the best / most modern tools for the task.
