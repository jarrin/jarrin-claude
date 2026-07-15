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
| `.claude/.jarrin.yml` | yes | Lists rule slugs to load; each maps to `~/.claude/rules/<slug>.md`. **Missing → error** on stderr. |
| `.claude/.jarrin-claude.md` | no | Extra project instructions, appended verbatim. **Missing → silently ignored.** |

Example `.claude/.jarrin.yml`:

```yaml
rules:
  - lang-php
  - fw-laravel
```

The hook reads the session `cwd` from its stdin JSON, resolves each slug against the
global rule library, and emits the combined text as the SessionStart
`additionalContext`. Referenced rule files that don't exist are warned about and skipped.
Override the library location for testing with `JARRIN_RULES_DIR`.

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
