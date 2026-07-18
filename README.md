# jarrin-claude

Version-controlled Claude Code configuration. The canonical files live here under
`claude/` and are **symlinked** into `~/.claude/`. Secrets and machine-local runtime
state (`.credentials.json`, transcripts, caches, session state) stay in `~/.claude/`
and are deliberately **not** part of this repo — they can never be committed because
they are not in the working tree.

## Layout

| Path                       | Purpose                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `src/`, `dist/`            | The `claudjar` CLI (TypeScript source; `dist/claudjar.js` is the built bundle, gitignored) |
| `bin/claudjar`             | Repo-local launcher for the CLI (`bin/claudjar install`, `init`, …)                        |
| `CLAUDE.md`                | Guide for working **in this repo** — how to author rule files                              |
| `claude/CLAUDE.md`         | Global, cross-project instructions (loaded every session)                                  |
| `claude/settings.json`     | Global Claude Code settings (registers the SessionStart + SessionEnd hooks)                |
| `bin/claude/session-start` | SessionStart hook launcher → `dist/claudjar.js session-start` (linked to `~/.claude/bin/`) |
| `bin/claude/session-end`   | SessionEnd hook launcher → `dist/claudjar.js session-end` (linked to `~/.claude/bin/`)     |
| `claude/rules/*.md`        | Global rule library (`lang-php.md`, `fw-laravel.md`, …)                                    |
| `claude/skills/*/`         | Global skills (e.g. `add-skill/` — how to author a skill)                                  |
| `claude/references/*.md`   | Shared reference docs read by more than one skill (`backlog.md`)                           |

Language-/framework-specific guidance goes in `claude/rules/*.md`. Projects opt in to
specific rules via their own `.claude/.jarrin.yml` — see **Rule loading** below. The
`claudjar` CLI scaffolds that file for a repo — see **The claudjar CLI** below.

## Install on a new machine

```bash
git clone <remote> ~/projects/jarrin-claude
~/projects/jarrin-claude/bin/claudjar install
```

`claudjar install` is idempotent — it symlinks the config into `~/.claude` (backing up
any real file already there), **puts the `claudjar` command on your PATH** (a symlink to
the bundle in `~/.local/bin`, override with `CLAUDJAR_BIN_DIR`; it warns if that dir isn't
on PATH), enables the secret-scanning git hook, and checks prerequisites (`node`,
`gitleaks`). Re-run it any time; set `CLAUDE_HOME` to target a non-default config dir,
`--with-gitleaks` to auto-download gitleaks, `--yes` to overwrite without prompting.

`dist/` is a **gitignored build artifact**, so a fresh clone must build the bundle once
before `bin/claudjar` or the session hooks can run:

```bash
pnpm install && pnpm build
```

The launchers check for the bundle and print exactly that instruction when it is missing —
`bin/claudjar` exits non-zero, while the two session hooks warn and exit 0 so a missing
bundle degrades a session (no injected rules) instead of blocking every session on the
machine.

<details>
<summary>What it does / manual equivalent</summary>

```bash
mkdir -p ~/.claude
ln -sfn ~/projects/jarrin-claude/claude/CLAUDE.md     ~/.claude/CLAUDE.md
ln -sfn ~/projects/jarrin-claude/claude/settings.json ~/.claude/settings.json
ln -sfn ~/projects/jarrin-claude/bin/claude           ~/.claude/bin
ln -sfn ~/projects/jarrin-claude/claude/rules         ~/.claude/rules
ln -sfn ~/projects/jarrin-claude/claude/skills        ~/.claude/skills
ln -sfn ~/projects/jarrin-claude/claude/references    ~/.claude/references
cd ~/projects/jarrin-claude && git config core.hooksPath .githooks   # enable pre-commit hook
```

Or, with GNU stow: `stow -d ~/projects/jarrin-claude -t ~/.claude claude`
</details>

## Secret scanning (gitleaks)

`.githooks/pre-commit` runs [gitleaks](https://github.com/gitleaks/gitleaks) against
staged changes and aborts the commit if a secret is detected. It is version-controlled,
so it travels with the repo — but git never auto-enables hooks on clone, so run
`git config core.hooksPath .githooks` once per machine (see above).

- Requires the `gitleaks` binary on PATH. If it's missing, the hook warns and lets the
  commit through (it degrades gracefully rather than blocking work).
- Install: download the release binary to `~/.local/bin`, or `brew install gitleaks`.
- Bypass a false positive with `git commit --no-verify` (use sparingly).

## Rule loading (per project)

A `SessionStart` hook — `bin/claude/session-start` (a launcher for the Node bundle),
registered in `claude/settings.json` and symlinked to `~/.claude/bin/` — loads a project's
chosen rules into context at the start of every session. It needs **Node** on PATH.

A project opts in with two files in its own `.claude/` directory:

| File                        | Required | Behaviour                                                                                                                         |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/.jarrin.yml`       | yes      | Selects rules (three tiers) + an optional command table. **Missing → error** on stderr.                                           |
| `.claude/.jarrin-claude.md` | no       | The repo's always-apply project instructions (hard rules, "Start here" prose), appended verbatim. **Missing → silently ignored.** |

`.jarrin.yml` selects rules from three tiers and can declare a command table:

```yaml
rules: # a. global slugs → ~/.claude/rules/<slug>.md
  - lang-php
  - fw-laravel
local: # b. in-repo rule files (paths from the repo root)
  - .claude/rules/some-local-rule.md
imports: # c. cross-repo: owner repo + a rule it owns
  - owner: server #    → <group-root>/server/.claude/rules/prdl-data-types.md
    rule: prdl-data-types
commands: # rendered as a command table
  - cmd: prdl deploy
    desc: ship to production
backup: git bundle create ../backup.bundle --all # run before a new session / clear
```

The repo's always-apply project instructions — its hard rules and "Start here"
orientation — go in `.claude/.jarrin-claude.md` as prose (appended verbatim); there is
no structured `start:` key.

A scalar **`backup:`** command is run by the hook before a genuinely new session or a
`/clear` starts (sources `startup` and `clear`; `resume` and `compact` skip it). Unlike
`backlog:`, this key is hook-consumed. A failed backup is fatal — the hook exits non-zero
and injects no context, so the session does not start without its safety net; the
command's output is relayed to stderr, never stdout (which carries the hook's JSON).

`.jarrin.yml` may also carry a **`backlog:`** block, which chooses whether plans and
todos are tracked as local files (the default) or as issues on a git forge. The hook
ignores it — it is skill-consumed, read by the `staged-planning` and `todo` skills. See
`CLAUDE.md` for the schema, and `claude/references/backlog.md` for the shared rules both
skills implement (config resolution, labels, milestones, retrieval).

A committed **`project:`** block gives each worktree a runtime stack (see **The claudjar
CLI** below): the SessionStart hook runs its `start` on a new shell and shows the
worktree's `PROJECT_PORT`; a companion **SessionEnd** hook (`bin/claude/session-end`)
runs its `exit` when the shell exits. The main checkout is never affected.

The hook reads the session `cwd` from its stdin JSON, resolves the three tiers (global →
local → imports, each rule included once), renders the `commands` table, appends
`.jarrin-claude.md`, and emits the combined text as the SessionStart `additionalContext`.
Referenced rule files that don't exist are warned about and skipped; unknown top-level
`.jarrin.yml` keys are silently ignored. The group root defaults to the parent of the
repo's directory; override it with `JARRIN_GROUP_ROOT` and the global library with
`JARRIN_RULES_DIR` (both for testing). Unit tests are colocated `*.test.ts` files under
`src/` (Vitest) and run in the pre-commit hook via `pnpm check`.

> The hook is registered globally, so it runs in **every** project. Any repo without a
> `.claude/.jarrin.yml` prints the "not found" error to stderr each session (non-blocking
> — the session still starts).

## The claudjar CLI

One typed entrypoint (`@stricli/core` + `@clack/prompts`, strict TypeScript) backs the
subcommands:

| Command                        | What it does                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `claudjar init`                | Set up (new repo) or update `.claude/.jarrin.yml`, preserving comments + `backlog:`                              |
| `claudjar info`                | Print the merged, resolved config for this repo: rules (✓/✗), commands, project stack, backlog, worktree, skills |
| `claudjar worktree create <n>` | Add a git worktree and bootstrap it from the `worktree:` config (branch, copy, port, setup)                      |
| `claudjar worktree merge <n>`  | Merge a worktree branch into the current branch, remove the worktree (claude resolves conflicts)                 |
| `claudjar worktree list`       | List this repo's git worktrees                                                                                   |
| `claudjar goto <n>`            | Switch to a worktree by starting `claude` there; `main` goes back to the original checkout                       |
| `claudjar start` / `stop`      | Bring this worktree's `project:` stack up / down (`PROJECT_PORT` set) — no-op in the main checkout               |
| `claudjar install`             | Machine setup: symlink config into `~/.claude`, enable hooks, check prerequisites                                |
| `claudjar session-start`       | The SessionStart hook itself (reads the hook JSON on stdin) — not run by hand                                    |
| `claudjar session-end`         | The SessionEnd hook itself (reads the hook JSON on stdin) — not run by hand                                      |

`worktree create` reads the `worktree:` block from `.claude/.jarrin.local.yml` (a gitignored,
per-machine override merged over the committed `.jarrin.yml` — **only `worktree:` overrides**).
It runs `git worktree add` (a new branch unless one exists), copies the configured gitignored
files across — always `.jarrin.local.yml`, into which it **stamps the worktree's `name` and its
assigned `PROJECT_PORT`** (one past the highest already handed to a sibling worktree, never below
`project.port`) — then runs the `setup:` commands in order (`--no-setup` skips them). The stamped
name scopes forge todos/plans to the worktree (`worktree/<name>` label; see
`claude/references/backlog.md` §9). New worktrees default to the grouped sibling
`<parent>/<repo>-worktrees/<name>`; set `worktree.dir` to change that.

The optional **`project:`** block in the committed `.jarrin.yml` gives each worktree a runtime
stack that lives only as long as a Claude shell is open in it:

```yaml
project:
  port: 8000 # starting port; worktrees increment from here (main checkout unaffected)
  commands:
    start: docker compose up -d
    exit: docker compose down
```

The **SessionStart** hook runs `start` on a genuinely new shell (never on `/clear`, `resume`, or
`compact`) and surfaces the worktree's port in context on both `startup` and `clear`; the
**SessionEnd** hook runs `exit` when the shell exits (skipping `reason: clear`, so a `/clear`
never kills the stack). Both commands run with the worktree's port as **`PROJECT_PORT`**. The
whole feature is gated on a stamped `worktree.name`, so the main checkout is never affected.
`claudjar start` / `claudjar stop` drive the same start/exit by hand.

`worktree merge <name>` is the other half: run from the target worktree (e.g. `main`), it runs
`git merge --no-edit <name>` to pull the worktree's branch in, then removes the worktree and
deletes the branch (`--keep` merges only, leaving both in place). A **clean** merge tears down
and reports; on a **conflict** it keeps the worktree and branch and hands off to an interactive
`claude` session in the target, seeded with a prompt that names both sides and the conflicted
files so Claude Code can resolve them in place. `--no-claude` skips the launch and just prints
the conflicted paths for a manual resolution.

`claudjar goto <name>` switches between worktrees. Because a process cannot change its parent
shell's directory, switching means **starting a fresh `claude` session in the target** rather
than cd-ing — so the new session picks up that worktree's stamped identity and `PROJECT_PORT`
through the SessionStart hook, and you land back in the shell you started from when it exits.
`<name>` matches a linked worktree by branch first, then by directory basename (`goto x` reaches
one created as `feature/x`); the reserved name **`main`** returns to the original checkout.
Resolution runs against `git worktree list`, from the main worktree, so it works identically from
the main checkout and from inside any worktree — including hopping straight from one worktree to
another. An unknown name fails with the list of names that would have worked.

`init` is interactive by default (a clack checklist of rules from `~/.claude/rules`, plus
prompts for local rules, imports, commands, and a backup command). It auto-detects a
non-interactive environment (no TTY, `CI`, or `JARRIN_NO_INTERACTION`) and can be forced
with `--no-interaction`, in which case it is driven entirely by flags:

```bash
bin/claudjar init --no-interaction --rule lang-ts --rule fw-nuxtjs \
  --command "pnpm check=run all gates" --backup "git bundle create ../b.bundle --all"
```

Running the CLI:

- `claudjar <cmd>` — after `claudjar install` (which symlinks it into `~/.local/bin`).
- `bin/claudjar <cmd>` — repo-local launcher (works on a fresh clone; the bundle is committed).
- `pnpm claudjar <cmd>` — via the package script (after `pnpm run build`).
- `pnpm run ensurepath` — alternative: build + `pnpm link --global` (for a pnpm-global bin dir).
- `pnpm dev <cmd>` — run from TypeScript source with `tsx` (development).

Development gates (`lang-ts` rules): `pnpm run check` = ESLint + Prettier + `tsc --noEmit` +
Vitest + `tsup` build. The build runs to prove the source still bundles; `dist/` is
gitignored, so there is no staleness check. The pre-commit hook runs the whole gate.

## Notes / caveats

- **Atomic-rename can break a file symlink.** If a tool rewrites `settings.json` via
  temp-file + rename, it may replace the symlink with a real file and your repo copy
  goes stale. Check occasionally: `ls -l ~/.claude/settings.json` should show `->`.
- Whole config **directories** (`rules/`, `skills/`, `commands/`, `agents/`) are safe
  to symlink at the directory level and are rename-proof.
- **Optional backstop:** install `gitleaks` and add a pre-commit hook so a secret
  pasted into a tracked file can't be committed.
