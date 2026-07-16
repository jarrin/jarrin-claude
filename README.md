# jarrin-claude

Version-controlled Claude Code configuration. The canonical files live here under
`claude/` and are **symlinked** into `~/.claude/`. Secrets and machine-local runtime
state (`.credentials.json`, transcripts, caches, session state) stay in `~/.claude/`
and are deliberately **not** part of this repo — they can never be committed because
they are not in the working tree.

## Layout

| Path | Purpose |
|------|---------|
| `bin/install` | One-shot, idempotent new-machine setup (symlinks + hooks + checks) |
| `CLAUDE.md` | Guide for working **in this repo** — how to author rule files |
| `claude/CLAUDE.md` | Global, cross-project instructions (loaded every session) |
| `claude/settings.json` | Global Claude Code settings (registers the SessionStart hook) |
| `bin/claude/session-start` | SessionStart hook — loads per-project rule selection (deployed to `~/.claude/bin/`) |
| `claude/rules/*.md` | Global rule library (`lang-php.md`, `fw-laravel.md`, …) |
| `claude/skills/*/` | Global skills (e.g. `add-skill/` — how to author a skill) |
| `claude/references/*.md` | Shared reference docs read by more than one skill (`backlog.md`) |

Language-/framework-specific guidance goes in `claude/rules/*.md`. Projects opt in to
specific rules via their own `.claude/.jarrin.yml` — see **Rule loading** below.

## Install on a new machine

```bash
git clone <remote> ~/projects/jarrin-claude
~/projects/jarrin-claude/bin/install
```

`bin/install` is idempotent — it symlinks the config into `~/.claude` (backing up any
real file already there), enables the secret-scanning git hook, and checks prerequisites
(`python3`, `gitleaks`). Re-run it any time; set `CLAUDE_HOME` to target a non-default
config dir.

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

A `SessionStart` hook — `bin/claude/session-start` (Python, stdlib only), registered in
`claude/settings.json` and symlinked to `~/.claude/bin/` — loads a project's chosen rules
into context at the start of every session.

A project opts in with two files in its own `.claude/` directory:

| File | Required | Behaviour |
|------|----------|-----------|
| `.claude/.jarrin.yml` | yes | Selects rules (three tiers) + an optional command table. **Missing → error** on stderr. |
| `.claude/.jarrin-claude.md` | no | The repo's always-apply project instructions (hard rules, "Start here" prose), appended verbatim. **Missing → silently ignored.** |

`.jarrin.yml` selects rules from three tiers and can declare a command table:

```yaml
rules:                              # a. global slugs → ~/.claude/rules/<slug>.md
  - lang-php
  - fw-laravel
local:                              # b. in-repo rule files (paths from the repo root)
  - .claude/rules/some-local-rule.md
imports:                            # c. cross-repo: owner repo + a rule it owns
  - owner: server                   #    → <group-root>/server/.claude/rules/prdl-data-types.md
    rule: prdl-data-types
commands:                           # rendered as a command table
  - cmd: prdl deploy
    desc: ship to production
```

The repo's always-apply project instructions — its hard rules and "Start here"
orientation — go in `.claude/.jarrin-claude.md` as prose (appended verbatim); there is
no structured `start:` key.

`.jarrin.yml` may also carry a **`backlog:`** block, which chooses whether plans and
todos are tracked as local files (the default) or as issues on a git forge. The hook
ignores it — it is skill-consumed, read by the `staged-planning` and `todo` skills. See
`CLAUDE.md` for the schema, and `claude/references/backlog.md` for the shared rules both
skills implement (config resolution, labels, milestones, retrieval).

The hook reads the session `cwd` from its stdin JSON, resolves the three tiers (global →
local → imports, each rule included once), renders the `commands` table, appends
`.jarrin-claude.md`, and emits the combined text as the SessionStart `additionalContext`.
Referenced rule files that don't exist are warned about and skipped; unknown top-level
`.jarrin.yml` keys are silently ignored. The group root defaults to the parent of the
repo's directory; override it with `JARRIN_GROUP_ROOT` and the global library with
`JARRIN_RULES_DIR` (both for testing). Unit tests live in
`bin/claude/test_session_start.py` and run in the pre-commit hook.

> The hook is registered globally, so it runs in **every** project. Any repo without a
> `.claude/.jarrin.yml` prints the "not found" error to stderr each session (non-blocking
> — the session still starts).

## Notes / caveats

- **Atomic-rename can break a file symlink.** If a tool rewrites `settings.json` via
  temp-file + rename, it may replace the symlink with a real file and your repo copy
  goes stale. Check occasionally: `ls -l ~/.claude/settings.json` should show `->`.
- Whole config **directories** (`rules/`, `skills/`, `commands/`, `agents/`) are safe
  to symlink at the directory level and are rename-proof.
- **Optional backstop:** install `gitleaks` and add a pre-commit hook so a secret
  pasted into a tracked file can't be committed.
