# jarrin-claude

Version-controlled Claude Code configuration. The canonical files live here under
`claude/` and are **symlinked** into `~/.claude/`. Secrets and machine-local runtime
state (`.credentials.json`, transcripts, caches, session state) stay in `~/.claude/`
and are deliberately **not** part of this repo — they can never be committed because
they are not in the working tree.

## Layout

| Path                     | Purpose                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/`, `dist/`          | The `claudjar` CLI (TypeScript source; `dist/claudjar.cjs` bundle + `dist/build/claudjar` standalone binary, both gitignored) |
| `scripts/`               | Build helpers (`build-binary.mjs` — the standalone executable; `ensurepath.mjs`)                                              |
| `bin/claudjar`           | Repo-local launcher for the CLI (`bin/claudjar install`, `init`, …)                                                           |
| `CLAUDE.md`              | Guide for working **in this repo** — how to author rule files                                                                 |
| `claude/CLAUDE.md`       | Global, cross-project instructions (loaded every session)                                                                     |
| `claude/settings.json`   | Global Claude Code settings (points the SessionStart hook and statusline at `~/.local/bin/claudjar api …`)                    |
| `claude/rules/*.md`      | Global rule library (`lang-php.md`, `fw-laravel.md`, …)                                                                       |
| `claude/skills/*/`       | Global skills (`claudjar/` — drive the CLI; `add-skill/` — how to author a skill)                                             |
| `claude/references/*.md` | Shared reference docs read by more than one skill (`backlog.md`)                                                              |

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
the standalone binary in `~/.local/bin`, override with `CLAUDJAR_BIN_DIR`; it warns if that
dir isn't on PATH, and offers to build the binary when it is missing), enables the
secret-scanning git hook, and checks prerequisites (`node`,
`gitleaks`). Re-run it any time; set `CLAUDE_HOME` to target a non-default config dir,
`--with-gitleaks` to auto-download gitleaks, `--yes` to overwrite without prompting.

`dist/` is a **gitignored build artifact**, so a fresh clone must build once before
`bin/claudjar`, the `claudjar` command, or the session hooks can run:

```bash
pnpm install && pnpm run ensurepath
```

`ensurepath` checks for a build, offers to make one, then runs `claudjar install` to link
everything. `pnpm run build` alone produces both artifacts: `dist/claudjar.cjs` (the
bundle) and `dist/build/claudjar` (a ~118 MB standalone executable with the Node runtime
embedded — it needs nothing on PATH). `install` symlinks that executable to
`~/.local/bin/claudjar`, which is what `claude/settings.json` calls for the statusline and
the SessionStart hook.

<details>
<summary>What it does / manual equivalent</summary>

```bash
mkdir -p ~/.claude
ln -sfn ~/projects/jarrin-claude/claude/CLAUDE.md     ~/.claude/CLAUDE.md
ln -sfn ~/projects/jarrin-claude/claude/settings.json ~/.claude/settings.json
ln -sfn ~/projects/jarrin-claude/claude/rules         ~/.claude/rules
ln -sfn ~/projects/jarrin-claude/claude/skills        ~/.claude/skills
ln -sfn ~/projects/jarrin-claude/claude/references    ~/.claude/references
mkdir -p ~/.local/bin
ln -sfn ~/projects/jarrin-claude/dist/build/claudjar  ~/.local/bin/claudjar
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

A `SessionStart` hook — `claudjar api session-start`, registered in `claude/settings.json`
as `$HOME/.local/bin/claudjar` — loads a project's chosen rules into context at the start
of every session. The standalone binary embeds its own Node runtime, so nothing else needs
to be on PATH.

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
CLI** below), brought up and down by hand with `claudjar start` / `claudjar stop`. No
session hook starts or stops it: SessionStart only surfaces the worktree's assigned
`PROJECT_PORT` in context, and the statusline shows whether anything is listening on it.
The main checkout is never affected.

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

| Command                         | What it does                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `claudjar init`                 | Set up (new repo) or update `.claude/.jarrin.yml`, preserving comments + `backlog:`                                |
| `claudjar info`                 | Print the merged, resolved config for this repo: rules (✓/✗), commands, project stack, backlog, worktree, skills   |
| `claudjar worktree create <n>`  | Add a git worktree and bootstrap it from the `worktree:` config (branch, copy, port, setup)                        |
| `claudjar worktree merge <n>`   | Merge a worktree branch into the current branch, keeping it (`--remove` to clean up; claude resolves conflicts)    |
| `claudjar worktree remove <n>`  | Remove a worktree: stop its stack, delete the directory, safely delete the branch (`--no-teardown` skips the stop) |
| `claudjar worktree list`        | List this repo's git worktrees                                                                                     |
| `claudjar goto <n>`             | Switch to a worktree by starting `claude` there; `main` goes back to the original checkout                         |
| `claudjar start` / `stop`       | Bring this worktree's `project:` stack up / down (`PROJECT_PORT` set) — no-op in the main checkout                 |
| `claudjar caddy up` / `down`    | Start / stop the machine-wide caddy on host port 80 (one container serves every registered project)                |
| `claudjar caddy join` / `leave` | Register / deregister this checkout's `<slug>.localhost` route (worktrees register themselves on create)           |
| `claudjar caddy status`         | Show the caddy container state and every registered route                                                          |
| `claudjar release`              | Cut a version: bump `project.dist.version`, mirror it into `sync:` files, build, commit, tag (never pushes)        |
| `claudjar install`              | Machine setup: symlink config into `~/.claude`, link the binary onto PATH, enable hooks, check prerequisites       |
| `claudjar help --full`          | Print every command's help as one Markdown document (`--include-internal` adds the `api` commands)                 |
| `claudjar api …`                | **Internal.** The hook entrypoints Claude Code invokes (`session-start`, `statusline`) — never run by hand         |

`worktree create` reads the `worktree:` block from `.claude/.jarrin.local.yml` (a gitignored,
per-machine override merged over the committed `.jarrin.yml` — **only `worktree:` overrides**).
It runs `git worktree add` (a new branch unless one exists), copies the configured gitignored
files across — always `.jarrin.local.yml`, into which it **stamps the worktree's `name` and its
assigned `PROJECT_PORT`** (one past the highest already handed to a sibling worktree, never below
`project.port`) — then runs the `setup:` commands in order (`--no-setup` skips them). The stamped
name scopes forge todos/plans to the worktree (`worktree/<name>` label; see
`claude/references/backlog.md` §9). New worktrees default to the grouped sibling
`<parent>/<repo>-worktrees/<name>`; set `worktree.dir` to change that.

**Creating from inside a worktree** branches from where you stand, and keeps the folder flat.
Run `claudjar worktree create x` in worktree `dev` and you get branch **`dev-x`** — cut from
`dev`'s HEAD, not main's — in `<repo>-worktrees/dev-x`, a **sibling** of `dev` rather than a
directory nested inside it. The prefix is the current worktree's stamped `name`, so lineage
stays readable however deep the chain goes (`dev` → `dev-x` → `dev-x-y`) while the worktrees
folder stays one level. An already-prefixed name is not prefixed twice, so `create x` and
`create dev-x` from `dev` both mean `dev-x`. Gitignored `copy:` files come from the current
worktree too, so the new tree's `.env` matches the code its branch was cut from. Only the base
directory is resolved against the main checkout — that is what keeps the folder flat. From the
main checkout there is no prefix and nothing changes.

The optional **`project:`** block in the committed `.jarrin.yml` gives each worktree a runtime
stack bound to its own port, and declares how the project is released:

```yaml
project:
  port: 8000 # starting port; worktrees increment from here (main checkout unaffected)
  commands:
    start: docker compose up -d
    exit: docker compose down
    build: pnpm run build # run by `claudjar release`
  dist:
    version: 0.1.4 # source of truth for the released version
    sync: # files carrying the same version, rewritten on release
      - package.json
      - .env # add/update APP_VERSION
      - src/worker/pyproject.toml
```

The stack is driven **by hand**: `claudjar start` and `claudjar stop` run `start` / `exit` with
the worktree's port as **`PROJECT_PORT`**. Sessions never start or stop it — the **SessionStart**
hook only surfaces the assigned port in context (on `startup` and `clear`), and the statusline
shows a green `●` when something is actually listening on that port, a dim `○` when it is not.

Teardown is automatic only where a worktree is being retired: **`worktree remove`** and
**`worktree merge --remove`** run `exit` before deleting the directory, since the compose file
lives inside it. The whole feature is gated on a stamped `worktree.name`, so the main checkout is
never affected.

`worktree merge <name>` is the other half: run from the target worktree (e.g. `main`), it runs
`git merge --no-edit <name>` to pull the worktree's branch in and then **stops** — the worktree
and branch are kept, because merging work up is not the same as being finished with the worktree.
Add `--remove` to clean up in the same step (`--no-teardown` leaves the stack running); if the
stack's `exit` fails it stops there and keeps the worktree, so containers never outlive the
directory that can stop them. `worktree remove <name>` does that cleanup on its own, deleting the
branch with `git branch -d` so unmerged work is reported rather than discarded. On a
**conflict** merge keeps the worktree and branch and hands off to an interactive
`claude` session in the target, seeded with a prompt that names both sides and the conflicted
files so Claude Code can resolve them in place. `--no-claude` skips the launch and just prints
the conflicted paths for a manual resolution.

The optional **`hooks:`** block adds committed, shared commands at worktree lifecycle points:

```yaml
hooks:
  worktree:
    create: # run IN the new worktree, after worktree.setup
      - pnpm install
    remove: # run FROM this checkout, after the worktree is deleted
      - docker system prune -f
```

Both run in order, stop at the first failure, and get `WORKTREE_NAME`, `WORKTREE_PATH`, and
`PROJECT_PORT` in the environment (`--no-hooks` skips them). These are not a duplicate of
`worktree.setup`: `setup` is the machine-specific bootstrap in the gitignored local file, hooks
are project policy every clone applies — so setup runs first and hooks may assume a
bootstrapped tree. `remove` hooks necessarily run after the directory is gone, so they execute
from the checkout that ordered the removal and `WORKTREE_PATH` names a path that no longer
exists; the port is captured before deletion, while the worktree's stamped config still exists.

### Domains (`caddy:`)

Add a slug and one switch, and the repo gets a `.localhost` domain:

```yaml
project:
  slug: prdl

caddy:
  enabled: true
```

The scheme is `<service>.<worktree>.<slug>.localhost`, both leading segments optional —
`prdl.localhost`, `studio.prdl.localhost`, `studio.dev.prdl.localhost`. A worktree's segment is
its stamped `worktree.name` (or `worktree.slug`, to shorten a long branch name in a URL).

**claudjar owns one side only.** It runs a single `claudjar-caddy` container on host port 80,
attached to a shared `claudjar` docker network, and generates that container's config. Your
project brings its **own** caddy: in its own compose file, on its own network, joining `claudjar`
as an external second network, listening on container port **8000**. claudjar proxies the whole
domain there and stops — routing `studio.` to a service is your project's config, which claudjar
never reads or writes. The original `Host` header is preserved, so the project's caddy sees the
full name.

Since the two sides never negotiate, the upstream name is a **convention**: `caddy-<slug>`, or
`caddy-<slug>-<worktree>` for a worktree. Name your caddy container that, or give it that network
alias. A project that isn't up yet just 502s — the two halves start independently.

```sh
claudjar caddy up      # once per machine: network + container on :80
claudjar caddy join    # once per project: register <slug>.localhost
claudjar caddy status  # container state + every registered route
```

Routes live in `~/.claudjar/caddy/registry.yml` (machine-wide, since the generated Caddyfile
names projects the current directory knows nothing about). That registry is the source of truth;
the `Caddyfile` beside it is regenerated wholesale on every change, so hand-edits there are lost.
`worktree create` registers a new worktree's route automatically, `worktree remove` /
`merge --remove` drop it, and `init` registers the repo when the config it writes opts in.
Reloading a caddy that isn't running is a no-op rather than an error, so `join` works before
`caddy up` was ever run.

### Releasing

`claudjar release` cuts a version from `project.dist`:

```bash
claudjar release                 # 0.1.3 -> 0.1.4
claudjar release --bump minor    # 0.1.3 -> 0.2.0
claudjar release --dry-run       # show the plan, write nothing
```

It refuses unless you are on `main` (`--branch` overrides) with a clean working tree, and
refuses to reuse an existing tag. Then it writes the new version to `.jarrin.yml` and every
`sync:` file, runs `project.commands.build`, commits the tree as `Release v<version>`, and
creates an annotated tag. **Nothing is pushed** — it prints `git push --follow-tags` for you.

The order is deliberate: the version is on disk _before_ the build, so the artifact carries the
number it will be tagged with; the commit happens _after_, so a broken build never produces a
release commit. If the build fails, every rewritten file is restored and the tree is left
exactly as it was found.

Version fields are located by filename and rewritten in place, preserving formatting:

| File              | What is rewritten                                        |
| ----------------- | -------------------------------------------------------- |
| `*.json`          | the top-level `"version"` string                         |
| `.env`, `.env.*`  | `APP_VERSION=…` (appended when absent)                   |
| `*.toml`          | `version` in `[project]` / `[tool.poetry]` / `[package]` |
| `*.yml`, `*.yaml` | the top-level `version:` key                             |

Scoping is the point: the JSON handler tracks brace depth and the TOML handler tracks the
current table, so a pinned dependency's version is never mistaken for the project's own.

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

- `claudjar <cmd>` — the standalone binary, after `claudjar install` symlinks it into
  `~/.local/bin`.
- `pnpm run ensurepath` — build (if needed) and install, in one step. Start here on a fresh
  clone.
- `bin/claudjar <cmd>` — repo-local launcher; prefers the binary, falls back to the bundle.
- `pnpm claudjar <cmd>` — the bundle via the package script (after `pnpm run build`).
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
