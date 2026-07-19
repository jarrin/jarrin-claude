# `claudjar` CLI — design + implementation notes

Design for a single Node.js CLI that (a) sets up / updates a project's
`.claude/.jarrin.yml` config, and (b) replaces the shell/Python scripts formerly
under `bin/` (`bin/install`, `bin/claude/session-start`) with one typed, tested
Node entrypoint.

**Status: implemented.** The CLI is named **`claudjar`** (this doc predates that
name and still says `jarrin`/`dist/jarrin.js` in places — read those as
`claudjar`/`dist/claudjar.js`). It ships as `src/` → committed `dist/claudjar.js`,
with `bin/claudjar` (repo launcher) and `bin/claude/session-start` (hook launcher).
The "Open decisions" in §13 were all resolved as recommended, except the CLI name
(`claudjar`, not `jarrin`). See the README's **The claudjar CLI** section for usage.

---

## 1. Goals & scope

1. Add a `jarrin init` command that bootstraps `.claude/.jarrin.yml` in a project
   that does **not** have one, and updates it when it already does. One command,
   two modes, auto-detected.
2. Interactive by default (via `@clack/prompts`); accept `--no-interaction` for
   unattended runs, auto-detecting non-interactive environments.
3. Port `bin/install` and `bin/claude/session-start` from shell/Python to Node.
4. Ship them behind **one entrypoint** (`jarrin`) with subcommands, built on
   [`@stricli/core`](https://github.com/bloomberg/stricli) for typed args.
5. Keep the whole thing strongly typed (`lang-ts` rules: pnpm, strict `tsc`,
   ESLint + Prettier, Vitest), and keep the enforcement gates (pre-commit,
   gitleaks) green.

Non-goals: no change to _what_ rules/config mean; no new `.jarrin.yml` keys; no
e2e tests; no network features beyond what `install --with-gitleaks` already did.

---

## 2. Why these tools

- **stricli** — zero runtime deps, TypeScript-first, types flags + positionals,
  encapsulates all system access in a single injectable `context` (→ trivial to
  unit-test without touching the real filesystem/stdout). Fits the "strong
  typing, no escape hatches" preference and keeps the path-invoked entrypoints
  (hook, installer) dependency-light.
- **@clack/prompts** — the interactive layer for `init`/`install` only. Loaded
  **lazily** so the hook path never pays for it. Gives us `intro`/`outro`,
  `text`, `select`, `multiselect`, `confirm`, `spinner`, `note`, plus first-class
  cancellation (`isCancel`) we must honour.

Division of labour: **stricli owns argv → typed values and routing; clack owns
human interaction; the command bodies own the actual work.** A command must be
fully driveable by flags alone (no clack) so `--no-interaction` is a real path,
not a degraded one.

---

## 3. Package & repository layout

Single package at the repo root (`type: "module"`, `packageManager: pnpm@…`,
Node LTS pinned).

```
package.json            # scripts, deps, "bin": { "jarrin": "./dist/jarrin.js" }
pnpm-lock.yaml          # committed
tsconfig.json           # strict
eslint.config.mjs       # flat config
src/
  cli.ts                # THE entrypoint: builds the app, calls run(app, argv, ctx)
  context.ts            # AppContext type + buildContext() (fs, io, env, cwd)
  interaction.ts        # non-interactivity detection + clack wrappers (lazy import)
  config/
    schema.ts           # JarrinConfig type (rules/local/imports/commands/backup/backlog)
    read.ts             # parse .jarrin.yml  (see §8 — real YAML parser)
    write.ts            # serialise + write .jarrin.yml (comment-preserving)
    catalog.ts          # discover available rule slugs from ~/.claude/rules
  commands/
    init.ts             # setup / update .jarrin.yml
    install.ts          # machine setup (port of bin/install)
    session-start.ts    # SessionStart hook (port of bin/claude/session-start)
  session-start/        # pure functions the hook composes (mirrors today's module)
    resolve.ts          # resolveRules(), renderCommands(), dedup(), etc.
  *.test.ts             # Vitest, colocated
dist/                   # BUILT, single-file bundle (see §5) — committed, see §5
bin/
  jarrin                # shim → node dist/jarrin.js "$@"   (repo-run bootstrap)
  claude/
    session-start       # shim → node <resolved>/dist/jarrin.js session-start "$@"
```

`bin/claude/` is still the directory symlinked to `~/.claude/bin/`, so
`session-start` continues to resolve at `$HOME/.claude/bin/session-start` exactly
as `claude/settings.json` expects — no settings change required (see §7 for the
alternative of pointing settings at `jarrin session-start` directly).

---

## 4. Command surface (stricli route map)

`buildApplication({ name: "jarrin", version, description, routeMap })` over:

Built by `buildRoutes(hideInternal)` in `src/routes.ts` — a factory, not a
constant, so the same tree can be rendered with internals hidden (the real CLI)
or visible (`help --full --include-internal`):

```ts
buildRouteMap({
  routes: {
    init: initCommand, // setup/update .claude/.jarrin.yml
    info: infoCommand, // print the merged, resolved config
    install: installCommand, // machine setup (symlinks, hooks, checks)
    worktree: worktreeRoutes, // create/merge/remove/list git worktrees
    goto: gotoCommand, // switch worktrees by launching claude there
    start: startCommand, // bring this worktree's project: stack up
    stop: stopCommand, // tear this worktree's project: stack down
    help: helpCommand, // --full: every command's help in one document
    api: apiRoutes, // INTERNAL: session-start, statusline (stdin JSON in)
  },
  docs: { brief: "…", hideRoute: { api: hideInternal } },
});
```

> **The `api` split.** Everything Claude Code invokes rather than a person lives
> under `claudjar api`, hidden from the default help via `hideRoute`. Hidden is not
> disabled: `claudjar api --help`, `--helpAll`, and `help --full --include-internal`
> all still reach it, and the launchers in `bin/claude/` call it as
> `api session-start` / `api statusline`.

> The `project:` stack lifecycle: `worktree create` assigns each worktree an
> incrementing `PROJECT_PORT`, and `claudjar start` / `claudjar stop` are the only
> way it goes up and down. No session hook touches it — SessionStart merely shows
> the assigned port on `startup`/`clear`. The automatic teardowns are
> `worktree remove` and `worktree merge --remove`, which run `project.commands.exit`
> before deleting the directory. The main checkout is never affected.

`src/cli.ts` is the only file that calls `run(app, process.argv.slice(2), ctx)`.
`ctx` is `buildContext()` for real runs; tests pass a fake context.

### Context object

```ts
export interface AppContext {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly io: { stdout: Writable; stderr: Writable; stdin: Readable };
  readonly fs: FsPort; // narrow, mockable fs surface
  readonly interactive: boolean; // resolved once, see §6
}
```

stricli binds context as `this` inside a command's `func` — the signature is
`func(this: AppContext, flags, ...positional)`. All fs/stdout/env access goes
through `this.*`, never Node globals, so every command is unit-testable with an
in-memory context.

---

## 5. Build & distribution

Two constraints pull against each other:

- **The hook and installer are invoked by absolute path** (`~/.claude/bin/…`,
  or `node bin/… install` from a fresh clone) — a **symlinked** file, so Node
  resolves `node_modules` relative to the _real_ file location. That breaks
  naive multi-file + `node_modules` layouts.
- **`install` is the bootstrap** — it runs on a fresh clone _before_ any
  toolchain is set up, so it cannot depend on `pnpm install` having run.

**Decision: bundle to a single self-contained file** (`tsup`/`esbuild`,
ESM, Node target) at `dist/jarrin.js`, and **commit `dist/`**. Rationale:

- A single file has no `node_modules` resolution problem under a symlink.
- A committed bundle means `git clone && node dist/jarrin.js install` works with
  zero prior install — the bootstrap chicken-and-egg is solved.
- `@clack/prompts` is bundled but **dynamically imported** inside the
  interaction layer, so the hot hook path (`session-start`) doesn't parse it.

Trade-off to accept: `dist/` is a build artifact in git. Mitigate with a
pre-commit check that `dist/` is up to date with `src/` (rebuild + `git diff
--exit-code dist/`), so a stale bundle can't be committed. (Alternative
considered: keep `session-start`/`install` as thin `sh` bootstraps that
`corepack pnpm i && build`. Rejected — the user asked for `bin/*` to _be_ Node,
and it reintroduces shell.)

`package.json` scripts: `build` (bundle), `dev` (`tsx src/cli.ts`), `lint`,
`format`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `check`
(lint + typecheck + test + build-is-clean).

---

## 6. `--no-interaction` and auto-detection

A global-style boolean flag on `init` (and `install`). stricli has no
application-level global flags yet, so declare it per interactive command.

```ts
"no-interaction": {
  kind: "boolean",
  brief: "Never prompt; use flags/defaults or fail if a required value is missing",
  default: false,   // the *resolved* value also flips true via auto-detect
}
```

**Resolution order for `interactive`** (computed once in `buildContext`, exposed
as `ctx.interactive`):

1. `--no-interaction` given → **non-interactive**.
2. Auto-detect non-interactive when **any** of:
   - `!process.stdin.isTTY || !process.stdout.isTTY` (piped/redirected — the
     "based on shell" the prompt asks about),
   - `process.env.CI` is set (CI systems),
   - `process.env.JARRIN_NO_INTERACTION` is set (explicit escape hatch),
   - the process is the SessionStart hook (always non-interactive — it speaks
     JSON on stdout).
3. Otherwise interactive.

Behaviour when non-interactive:

- `init` uses flags + sensible defaults; if a value is required and neither a
  flag nor an existing config supplies it, **exit non-zero with a clear message**
  naming the missing flag (never hang on a prompt).
- Every clack call is guarded: in non-interactive mode the interaction layer
  returns the flag/default instead of prompting. `isCancel(...)` from clack is
  always treated as an abort (exit code 130), including Ctrl-C.

---

## 7. `session-start` command (hook port)

A faithful port of `bin/claude/session-start` (see that file for the exact
semantics; keep them identical). Points the Node version must preserve:

- Reads the SessionStart **JSON payload from stdin** (`cwd`, `source`).
- Resolves the three rule tiers in load order (global → local → imports), each
  rule body included **once** (dedup: `rules` by slug, `imports` by owner+rule).
- Renders the `commands` table; appends `.claude/.jarrin-claude.md` verbatim.
- Emits `{ hookSpecificOutput: { hookEventName: "SessionStart",
additionalContext } }` as **JSON on stdout**, nothing else on stdout.
- **All diagnostics go to stderr** (missing-rule warnings, errors). stdout is
  reserved for the hook JSON — this discipline is load-bearing.
- `.jarrin.yml` missing → error + non-zero exit. Empty/only-header → inject
  nothing, exit 0. A referenced rule file missing → warn on stderr, keep going.
- `backup:` runs before `startup`/`clear` sources only; failure is **fatal**
  (non-zero, no context injected); its output is relayed to stderr.
- Honour `JARRIN_RULES_DIR` and `JARRIN_GROUP_ROOT` overrides (used by tests).

Node-specific care:

- **Startup latency**: this runs on _every_ session in _every_ repo. Keep the
  hook path free of clack/heavy imports; a zero-dep single-file bundle keeps
  Node cold-start to ~tens of ms.
- **Node availability**: today the hook needs only `python3`. Porting to Node
  makes Node a hard requirement for the hook. `install` must check for Node and
  warn loudly if absent (the way it warns about `python3` today). Document this
  as a new prerequisite in README + CLAUDE.md.
- settings.json currently calls `$HOME/.claude/bin/session-start`. Two options:
  **(a)** keep a `bin/claude/session-start` shim that execs the bundle (no
  settings change — recommended, least churn); **(b)** change settings to
  `$HOME/.claude/bin/jarrin session-start`. Recommend (a).

---

## 8. Config read/write model

Today the Python hook hand-rolls a tiny YAML subset to stay stdlib-only, and
**deliberately ignores** the nested `backlog:` block (the parser can't represent
two-level nesting; that is also why `backup:` is a one-line scalar). Moving to
Node lets us depend on a real YAML library.

**Decision: use the `yaml` package** for both reading and writing.

- **Reading** (`config/read.ts`): parse into the typed `JarrinConfig`. This
  removes the fragile subset parser. The hook still only _consumes_ the four
  rule/command tiers + `backup:` and ignores `backlog:` — but now by _choice in
  code_, not because the parser is blind. `backlog:` stays skill-owned.
- **Writing** (`config/write.ts`): `init` must **preserve existing comments and
  key order** when updating an existing file (the `yaml` package's Document AST
  supports this) — never clobber a user's hand-written `.jarrin.yml` into a
  re-serialised blob. For a brand-new file, emit a **commented template**
  matching the schema documented in `CLAUDE.md`.

Migration implications to flag (see §11): the "`backup:` must be a scalar
because the hook parser can't nest" rationale in `CLAUDE.md` / `README.md`
changes — with a real parser the constraint is gone, though we may keep
`backup:` scalar for simplicity. The Python `test_session_start.py` invariant
("a nested `backlog:` must not corrupt `rules`/`local`/`imports`/`commands`")
must be re-expressed as Vitest tests against the new parser.

---

## 9. `init` command spec

Detect mode by presence of `<cwd>/.claude/.jarrin.yml`:

- **absent → setup**: create `.claude/` if needed, write a new `.jarrin.yml`.
- **present → update**: load it, offer to add/remove rules, edit commands, etc.,
  write back preserving comments (§8).

Interactive flow (clack), all values also settable by flag for `--no-interaction`:

1. `intro("jarrin init")`.
2. **Rules** (`multiselect`) — choose global slugs from the catalog discovered in
   `~/.claude/rules` (`config/catalog.ts`), pre-checking any already present on
   update. Flag: `--rule <slug>` (variadic).
3. **Local rules** — optional paths to in-repo rule files. Flag: `--local <path>`
   (variadic).
4. **Imports** — optional `owner`/`rule` pairs. Flag: `--import <owner>:<rule>`
   (variadic, parsed).
5. **Commands** — optional `cmd`/`desc` rows for the quick-reference table.
6. **backup** — optional one-line backup command (`text`, default empty).
7. **`.jarrin-claude.md`** — offer to scaffold an empty project-instructions file
   if missing (`confirm`).
8. Show a **diff/preview** (`note`) of the file to be written; `confirm` before
   writing. `--yes`/`--no-interaction` skips the confirm.
9. `outro` with next steps ("restart your session to load the rules").

Flags summary: `--rule*`, `--local*`, `--import*`, `--command "cmd=desc"*`,
`--backup <cmd>`, `--jarrin-md` (scaffold the md), `--force` (overwrite without
prompt), `--no-interaction`, `--yes`.

Non-interactive `init` with no flags on an **absent** config writes a minimal
commented template and exits 0 (a safe default), printing what it did.

---

## 10. `install` command spec (port of `bin/install`)

Preserve current behaviour (see `bin/install`):

- Symlink `claude/{CLAUDE.md,settings.json,rules,skills,references}` and
  `bin/claude` into `~/.claude/` (target overridable via `CLAUDE_HOME`).
- Idempotent: an existing correct symlink is left alone; a real file/dir is
  backed up to `*.pre-jarrin.bak` **after confirmation** (clack `confirm`;
  `--yes`/non-interactive assumes "no" → skip, matching today's safe default).
- `git config core.hooksPath .githooks`.
- Prereq checks: **Node** (new — required by the ported hook), `gitleaks`.
- `--with-gitleaks` → best-effort download of the latest release for the current
  OS/arch into `GITLEAKS_BIN_DIR` (default `~/.local/bin`), same as today.
- Flags: `--with-gitleaks`, `--yes`/`-y`, plus `--no-interaction`.

Bootstrap note (from §5): runnable on a fresh clone as `node dist/jarrin.js
install` (or `./bin/jarrin install`) with no prior `pnpm install`, because the
bundle is committed.

---

## 11. Migration / files touched

- `bin/install` → `bin/jarrin` shim + `src/commands/install.ts`.
- `bin/claude/session-start` (Python) → `src/commands/session-start.ts` +
  `bin/claude/session-start` shim. Delete the Python file and
  `bin/claude/test_session_start.py`.
- `.githooks/pre-commit`: replace the `python3 -m unittest …` step with
  `pnpm test` (or `pnpm check`) + the `dist/` freshness check; keep gitleaks.
- `.claude/.jarrin.yml` (this repo): update the `commands:` table (drop the
  `python3 -m unittest …` row, add `pnpm check` / `pnpm dev …`).
- `CLAUDE.md`: rewrite the hook section — Node not Python, real YAML parser,
  the `backup:`-must-be-scalar rationale, the test location, and the `backlog:`
  "hook can't parse nesting" explanation (now "hook chooses to ignore it").
- `README.md`: update the layout table, prerequisites (Node), install snippet,
  and the manual-symlink `<details>` block.
- `claude/settings.json`: unchanged if we keep the `session-start` shim (§7,
  option a).

---

## 12. Tooling & enforcement (per `lang-ts`)

- **pnpm** only; deps added via CLI, `pnpm-lock.yaml` committed;
  `"packageManager": "pnpm@<v>"` pinned; Node LTS.
- **Vitest** — port every case in `test_session_start.py` (all three tiers,
  dedup, missing-file behaviour, `commands` rendering, backup gating, the
  nested-`backlog:` non-corruption invariant) plus new tests for `init`
  read/write round-trips and the `--no-interaction` detection matrix.
- **ESLint (flat) + Prettier**; Prettier owns formatting, ESLint correctness;
  `dist/` excluded from lint but still built.
- **Strict TS**: `tsc --noEmit` as a gate; no `any`/`@ts-ignore` without an
  inline justification.
- **Pre-commit** (`.githooks/pre-commit`): `eslint . && prettier --check . &&
tsc --noEmit && vitest run` + `dist/` freshness; gitleaks stays.

---

## 13. Open decisions for review

1. **Commit `dist/`?** (§5) Recommended yes, to keep the fresh-clone bootstrap
   dependency-free; the alternative is a shell bootstrap, which the "convert
   `bin/*` to Node" goal argues against.
2. **settings.json**: keep the `session-start` shim (no change) vs. point it at
   `jarrin session-start` (§7). Recommend the shim.
3. **CLI name**: `jarrin` (used throughout above). Alternatives: `jc`, or
   keeping `claude`-prefixed names. Recommend `jarrin`.
4. **`init` = one auto-detecting command** vs. separate `init`/`update`
   subcommands. Recommend one auto-detecting `init` (matches "setup … or update
   an existing one").
5. **Keep `backup:` as a one-line scalar** even though a real YAML parser no
   longer requires it? Recommend yes (simplicity), but correct the _rationale_
   in the docs.
6. **Bundler**: `tsup` (nicer DX) vs. raw `esbuild`. Recommend `tsup`.
