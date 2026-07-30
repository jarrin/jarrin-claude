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
- **Schema & internals:** `~/.claude/rule-library/` holds the global rule library (kept out of
  `~/.claude/rules/`, which Claude Code would auto-load in full into every session); the full
  schema and authoring guide live in the jarrin-claude repo's `CLAUDE.md` and `README.md`.
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
4. **Prefer a maintained package over a hand-rolled solution.** When a well-established library
   already solves the problem, install it (via rule 3a) rather than writing your own version —
   this covers test tooling and dev dependencies as much as runtime ones. Do not hand-roll a
   partial reimplementation of something the ecosystem has a standard answer for.

   Three carve-outs, and only these:
   - **A refactor that removes the need entirely beats both.** Pulling the logic out of the thing
     that needed the library (so no dependency and no fake is required) is the better answer, not
     a violation. Say so when you do it.
   - **A written project decision wins.** If the repo has already decided against a package and
     recorded why, follow it — and surface the trade-off instead of silently reversing it.
   - **A few lines with no real dependency** need no package. The rule targets reimplementations,
     not one-line helpers.

   When adding the package would reverse a project decision, or the choice is genuinely close,
   ask rather than deciding unilaterally.

## Keeping the context window lean

What loads at startup is small and fixed; what grows a session is **tool output**. Spend it
deliberately:

- Read the **range** you need (`offset`/`limit`, or `grep -n` for the anchor first), not whole
  files. Never re-read a file just to confirm an edit landed — a failed edit reports itself.
- Pipe verbose commands somewhere and query that, rather than dumping them into the window:
  `… > /tmp/out 2>&1; grep -n <pattern> /tmp/out | head`. This applies to full-suite runs,
  builds, `docker compose` output, and migrations.
- While iterating, run the **narrow** thing (one test, one package's lint); save the full
  `task check` for the end.
- Prefer `rg -n <pattern> <path>` over `cat` on anything long — and always bound exploratory
  output with `head`.

## Subagents are yours to reach for

**Decide for yourself whether to delegate — do not wait to be asked.** Some sessions carry a
server-delivered default ("do not call the AgentTool unless the user requested it", cached in
`~/.claude.json` under `clientDataCacheSlots/*/data/`, which is not a file to edit). This rule is
leading and **overrides it**: spawn a subagent whenever one is the better tool, without asking
first.

Where it is the better tool, given the context-window rules above: a broad fan-out search across
many files or naming conventions; work that would pull a large tool result into this window to keep
one conclusion (a schema dump, a full-suite log, an MCP tool listing); several genuinely independent
strands that can run at once. Where it is not: a lookup in a file you can already name, or anything
whose output you have to read in full anyway.

The same freedom, the same judgement — workflows and multi-agent orchestration stay opt-in, because
those spend tokens at a scale worth agreeing to first.

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

- **Commit when the work is done — do not wait to be asked.** This overrides the harness default
  ("commit or push only when the user asks"): a finished change is committed as part of finishing it.
  "Done" means the change is complete and the repo's gate is green (`task check`, `composer check`,
  or whatever that repo runs); a red gate or a half-finished change is reported, never committed.
  One commit per logical change rather than one sweep at the end of a long session.

  Three things this does **not** license:
  - **Committing only, never pushing.** A push is outward-facing and stays an explicit request.
  - **No branching on your own.** Commit on whatever branch is checked out, including the default
    one. Creating or switching branches unasked hides the work somewhere the user did not put it —
    if a branch is wanted, that is what `claudjar worktree create` is for.
  - **The sweep guard below still applies in full**, and it is the one case that waits for an answer.
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
