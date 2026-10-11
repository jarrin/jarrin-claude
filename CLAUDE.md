# jarrin-claude — repository guide

This repo is the version-controlled source for Jarrin's global Claude Code config; the
files under `claude/` are symlinked into `~/.claude/`. This document governs **how to
author rule files** in this repo. Jarrin's leading working preferences in
`claude/CLAUDE.md` still apply on top of everything here.

## Git workflow

Commit directly to `main` in this repo — do not create feature branches or open PRs for
routine changes. Push only when explicitly asked.

## Where rules live

- Global rule library: `claude/rules/*.md`, symlinked to `~/.claude/rule-library/`.
  **Never** to `~/.claude/rules/` — Claude Code auto-loads every `.md` in _that_
  directory as always-on global instructions, so the whole library would land in every
  session and a repo's `rules:` selection would decide nothing.
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
`SessionStart` hook assembles the selected rules at the start of every session. The hook is
registered in `claude/settings.json` as `$HOME/.local/bin/claudjar api session-start` —
the standalone binary directly, with no launcher script and no Node needed on PATH. The
`claudjar init` command scaffolds and updates a repo's `.jarrin.yml`; see the README's
**The claudjar CLI** section.

### Rules are delivered as memory, not as hook output

The hook does **not** inject the rules. It writes them to `<repo>/.claude/.jarrin-rules.md`
(generated, gitignored) and injects a ~260-byte pointer; a one-line `@` import in the repo's
`CLAUDE.md` is what actually loads them, as project memory.

That indirection is not decoration. Claude Code caps a hook's `additionalContext`: past
roughly 25 KB it spills the payload to a transcript file and shows the model a ~2 KB
preview. Four rule files plus a page of `.jarrin-claude.md` clears that easily, and the
truncation is **silent** — the session starts having quietly dropped most of what it
selected. Project memory has no such cap. Keep the pointer small; it is the one part that
can still hit the ceiling.

`claudjar init` writes both halves (the `CLAUDE.md` import and the `.gitignore` entry) and
is idempotent. A repo missing the import still works — the pointer tells the session to read
the file — but it costs a tool call and depends on the model obeying, so the hook warns on
stderr when it is absent.

A `.jarrin.yml` that is not valid YAML parses to _nothing selected_, which is
indistinguishable from a repo that opted out — so the hook warns on stderr when the file
fails to parse, rather than starting a session that silently lost all its rules.

- **`<project>/.claude/.jarrin.yml`** (required to activate) selects rules from three
  tiers and, optionally, declares a command quick-reference. All keys are optional; an
  empty file injects nothing (not an error):

  ```yaml
  # Tier a — global rule slugs → ~/.claude/rule-library/<slug>.md
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
  YAML shape works — but only _consumes_ the four rule/command tiers, `backup:`, the
  `project:` stack block, and the `worktree:` **identity** (`name` / `port`); it ignores
  every other top-level key. Unknown top-level keys are silently ignored. Override the group
  root with `JARRIN_GROUP_ROOT` and the library location with `JARRIN_RULES_DIR` (both for
  testing).

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
  but it deliberately ignores everything except the four rule/command tiers, `backup:`,
  `project:`, and the `worktree:` identity — `backlog:` is owned by the `staged-planning`
  and `todo` skills, which parse it themselves. A Vitest test pins the invariant: a nested
  `backlog:` block must never corrupt `rules` / `local` / `imports` / `commands`.

- A **`project:`** block in `.jarrin.yml` (committed, shared like the rule tiers) covers two
  things: a **per-worktree runtime stack** — a service stack (e.g. `docker compose`) bound to
  a port unique to each worktree — and, under `dist:`, the **release surface**:

  ```yaml
  project:
    port: 8000 # starting port; worktrees increment from here (main checkout unaffected)
    commands:
      start: docker compose up -d # run by `claudjar start`
      exit: docker compose down # run by `claudjar stop` and `worktree remove`
      build: pnpm run build # run by `claudjar release`, after the version bump
    dist:
      version: 0.1.4 # SOURCE OF TRUTH for the released version; release bumps it
      sync: # other files carrying the same version, rewritten in step
        - package.json
        - .env # add/update APP_VERSION
        - src/worker/pyproject.toml
  ```

  Both `start` and `exit` run with the worktree's assigned port in the environment as
  **`PROJECT_PORT`** (so a compose file binds `${PROJECT_PORT}`). The whole feature is gated
  on a stamped `worktree.name`, so **the main checkout is never affected**.

  **The stack is manual.** `claudjar start` / `claudjar stop` are the only way it goes up and
  down by intent. Sessions do not touch it — there is no SessionEnd hook, and SessionStart
  starts nothing; it only injects the worktree's assigned port into context (on `startup` and
  `clear`). This is deliberate: a stack whose lifetime tracked the Claude shell was torn down
  and rebuilt by every window close, and `/clear` had to be special-cased to avoid killing a
  stack the next session reused.

  Two things report or reclaim, rather than drive:

  - **The statusline** (`claudjar api statusline`) probes the port on each render and shows
    `⑂ <name> ●<port>` in green when something is listening, `○<port>` dim when not. Since
    nothing autostarts, that dot is the only honest signal that `start` was actually run.
    The probe is a 50 ms loopback TCP connect (`src/project/liveness.ts`) — on localhost a
    listener accepts in microseconds and a closed port refuses immediately, so it needs no
    cache despite running on the render path.
  - **`claudjar worktree remove`** (and `merge --remove`, which shares its implementation
    in `src/worktree/remove.ts`) runs `exit` in the worktree before deleting it — via
    `stopStackAt`, reading that worktree's own stamped config, so `exit` gets the port it
    was actually assigned. A failed teardown aborts before the removal, so containers never
    outlive the directory that can stop them; `--no-teardown` opts out.

  Both CLI and hook resolve the effective port as `worktree.port` (the worktree's stamped
  assignment) falling back to `project.port`. Because the assigned port lives in the
  gitignored local file, the SessionStart hook reads `.jarrin.local.yml` too (via the merged
  config), not the committed base alone.

- **`claudjar release`** cuts a version from `project.dist`. It refuses unless you are on
  `main` (`--branch` overrides) with a clean tree, and refuses to reuse an existing tag —
  a release commits and tags whatever is in the tree, so releasing from a feature branch or
  on top of uncommitted work produces a tag nobody can reproduce. Without `--bump` it
  increments the patch segment; `--bump major|minor|patch` picks another. An unset
  `project.dist.version` is treated as `0.0.0`, so a first release lands on `0.0.1`.

  The **ordering is the design**: the version is written (to `.jarrin.yml` and every `sync:`
  file) _before_ `commands.build` runs, so the artifact carries the number it will be tagged
  with; the commit happens _after_, so a broken build never produces a release commit. A
  failed build restores every file the command rewrote, leaving the tree exactly as found.
  Then it commits the whole tree as `Release v<version>` and creates an annotated tag.
  **Nothing is pushed** — the push line is printed for you to run.

  `sync:` handlers dispatch on filename (`src/release/sync.ts`) and rewrite **in place**,
  preserving formatting: `*.json` (top-level `"version"`), `.env*` (`APP_VERSION`, appended
  when absent), `*.toml` (`[project]` / `[tool.poetry]` / `[package]`), `*.yml`/`*.yaml`
  (top-level `version:`). Scoping matters — the JSON handler tracks brace depth and the TOML
  handler tracks the current table, so a pinned dependency's version is never mistaken for
  the project's own. A listed path that is missing, or whose type no handler claims, aborts
  the release; a file with no version field is warned about and skipped. Adding a format
  means one handler and one test, and nothing else in the flow changes.

- A **`caddy:`** block plus **`project.slug`** puts the repo on a `.localhost` domain,
  served by one machine-wide reverse proxy:

  ```yaml
  project:
    slug: prdl # last label before .localhost; also derives the upstream name

  caddy:
    enabled: true # the whole block — a single opt-in switch
  ```

  The domain scheme is `<service>.<worktree>.<slug>.localhost`, both leading segments
  optional: `prdl.localhost`, `studio.prdl.localhost`, `studio.dev.prdl.localhost`. A
  worktree's segment is its stamped `worktree.name`, or `worktree.slug` when that name is
  too long to want in a URL.

  **claudjar owns exactly one side of this.** It runs a single `claudjar-caddy` container
  on host ports 80 (http) and 443 (https, Caddy-internal certificates), attached to a
  shared `claudjar` docker network, and generates only that container's config. Each
  project supplies its **own** caddy — in its own compose file, on its own network, joining
  `claudjar` as an external second network, listening on container port **8000**. claudjar
  proxies the whole domain to that container and stops; routing `studio.` to a service
  happens inside the project, in config claudjar never reads or writes. That is the entire
  reason `caddy:` has one key: there is nothing else claudjar is entitled to know.

  TLS terminates at claudjar's caddy — the project side keeps speaking plain HTTP on 8000
  and needs no change to be reachable over https. Both schemes are served side by side with
  **no HTTP→HTTPS redirect**, so existing `http://` tooling keeps working. The certificates
  come from Caddy's internal CA, whose state lives in the `claudjar-caddy-data` volume and
  survives container recreation; `claudjar caddy trust` anchors its root + intermediate in
  the host trust store (`update-ca-trust` on Arch-family, `update-ca-certificates` on
  Debian-family — sudo, once per machine), after which curl and NSS-linked browsers verify
  the chain. The root is the durable anchor: Caddy rotates the intermediate and serves it
  in the TLS chain, so the trust-store copy of it going stale costs nothing.

  Because the two sides never negotiate, the upstream is a **convention**: `caddy-<slug>`
  for a main checkout, `caddy-<slug>-<worktree>` for a worktree. A project whose caddy
  container is named differently adds that as a network alias.

  Routes live in a machine-wide registry, `~/.claudjar/caddy/registry.yml`
  (`JARRIN_CADDY_DIR` overrides), because the generated Caddyfile has to name projects the
  current directory knows nothing about. The registry is the source of truth and the
  Caddyfile beside it is regenerated wholesale on every change — hand-edits to it are lost.
  `claudjar caddy join` / `leave` add and remove the current checkout's entry;
  `up` / `down` / `status` drive the container. Registration is also automatic at three
  points: `init` (when the written config opts in), `worktree create`, and `worktree remove`
  / `merge --remove`, which capture the route _before_ the directory is deleted and drop it
  after. A reload when nothing is running is a no-op, not a failure, so `join` works before
  `caddy up` was ever run and the routes are picked up later.

  Three details in `src/caddy/` are load-bearing and were all found by testing live, not by
  reading docs:

  - Site addresses are **scheme-prefixed, both of them**. A bare `prdl.localhost {` binds
    Caddy's HTTPS port (443) whatever `auto_https` says — the option governs certificate
    automation and redirects, not the default port. Only the scheme picks the port, so the
    `http://` block lands on 80 and the `https://` block on 443, and nothing listens where
    no host port is mapped.
  - The global option is **`auto_https disable_redirects`, never `off`**. Under `off` Caddy
    still provisions its internal CA but adds no site names to certificate automation —
    `tls internal` only names the issuer, automation is what drives issuance — so no leaf
    certificates exist and every handshake dies with a `tlsv1 internal error` alert.
    `disable_redirects` keeps issuance while the `http://` blocks keep serving plain HTTP.
  - The container runs with **`--dns-search .`**. Without it, an upstream that is merely not
    running does not fail: Docker's embedded DNS falls through to the host resolver, which
    appends the machine's search domain and can resolve `caddy-<slug>` to a real **external**
    host — quietly proxying a local request off the machine. Cleared, the single label either
    hits a container on the network or 502s.

  One operational consequence: port mappings are fixed at container creation, so `caddy up`
  recreates the running container (instead of reloading) when it does not yet publish both
  ports — the CA and registry both live outside it, so recreation loses nothing.

- A **`hooks:`** block in `.jarrin.yml` (committed, shared) runs shell commands at claudjar
  lifecycle points, in order, stopping at the first failure:

  ```yaml
  hooks:
    worktree:
      create: # run IN the new worktree, after worktree.setup
        - pnpm install
      remove: # run FROM this checkout, after the worktree is deleted
        - docker system prune -f
  ```

  Both receive `WORKTREE_NAME`, `WORKTREE_PATH`, and `PROJECT_PORT` in the environment.
  `--no-hooks` skips them on `worktree create` / `remove` / `merge --remove`.

  `create` hooks additionally get `SOURCE_WORKTREE_NAME`, `SOURCE_WORKTREE_PATH`, and
  `SOURCE_PROJECT_PORT` — the worktree the command ran in, which the new branch was cut
  from (the main checkout reports an empty name and port `0`). Creation is directional
  (`main → dev → dev-x`), so a hook that carries state forward — a database, a cache, a
  fixture set — needs to name where to carry it _from_, and the destination's own identity
  cannot tell it.

  `hooks.worktree.create` is **not** a duplicate of `worktree.setup`: `setup` is the
  machine-specific recipe in the gitignored local file (bootstrap for _this_ machine),
  while a hook is committed project policy every clone applies. Both fire on create — setup
  first, then hooks, which may therefore assume a bootstrapped tree.

  `remove` hooks necessarily run **after** the directory is gone, so they execute from the
  checkout that ordered the removal and `WORKTREE_PATH` names a path that no longer exists
  (cleaning up by path is the common case). The worktree's port is captured from its stamped
  local config _before_ deletion, since afterwards there is nothing left to read. A failing
  remove hook is reported and exits non-zero, but the removal already happened and is not
  undone.

- A **`worktree:`** block configures `claudjar worktree create <name>` — how a new git
  worktree for this repo is placed and bootstrapped. Its recipe (`dir`/`copy`/`setup`) is
  **CLI-consumed** (never `init`); its **identity** (`name`/`port`, stamped on create) is
  read by the CLI, the SessionStart hook, the statusline, and the `todo`/`staged-planning`
  skills. The
  whole block lives by convention in the gitignored **`.jarrin.local.yml`** (below), since
  where worktrees land, how they build, and each worktree's port are machine-specific:

  ```yaml
  worktree:
    dir: ../ # base for new worktrees, relative to the repo root; unset →
    #        grouped-sibling default <parent>/<repo>-worktrees/<name>
    copy: # gitignored files carried into a new worktree (always incl. .jarrin.local.yml)
      - .env
      - .claude/settings.local.json
    setup: # shell commands run in the new worktree after creation, in order
      - poetry install
    name: feature-x # identity marker — stamped by `worktree create`, not hand-set
    port: 8001 # assigned PROJECT_PORT — stamped by `worktree create`, not hand-set
    milestone: plan-x # linked milestone title — stamped by `create --milestone`, optional
  ```

  `create` runs `git worktree add` (new branch unless it exists), copies the `copy:` files
  across, carries Claude Code's workspace trust over from the source checkout (if it has
  any), assigns the next **`PROJECT_PORT`** (one past the highest already handed to a
  sibling worktree, never below `project.port`), **stamps `worktree.name` + `worktree.port`**
  into the new worktree's `.jarrin.local.yml`, then runs `setup:` in order (stopping on the
  first failure; `--no-setup` skips them). `create` does not launch the stack — nothing does
  automatically; run `claudjar start` in the new worktree. The stamped `name` is what the
  `staged-planning` and `todo` skills
  read to scope forge tickets to the worktree (`worktree/<name>` label; see
  `claude/references/backlog.md` §9); the stamped `port` is the worktree's `PROJECT_PORT`.
  `--milestone <title>` additionally stamps `worktree.milestone`, linking the worktree to the
  forge milestone it was made to work (the service pairs a worktree with its loop by it).
  Stamping without one clears the key, so `dev-x` never inherits `dev`'s link through the
  copied local file.

  **The CLI is a thin wrapper over `src/worktree/lib.ts`.** `createWorktree`,
  `mergeWorktree`, and `removeWorktree` take `(repoRoot, opts, deps)` and resolve to a typed
  result: `repoRoot` stands in for the cwd, and `deps` injects the narration (`log` / `warn`)
  and an **async** process runner (`src/worktree/runner.ts`), so the library reads no
  `process.*` global and the service can call it directly. The runner is async on purpose —
  setup commands and hooks run for minutes, and a `spawnSync` would freeze the service's
  event loop. The CLI's `--no-*` flags are the options' defaults inverted, and its
  `worktree <verb>: …` error line and exit code 1 are built from the result.

  **`create` is keyed on the worktree it runs in, not the main checkout.** The new branch is
  cut from the current worktree's HEAD (passed to `git worktree add` as an explicit SHA,
  since the command itself runs with `-C <mainRoot>` where a bare `HEAD` would mean main's
  commit), the `copy:` files are read from the current worktree, and the current worktree's
  stamped `name` **prefixes** the new one: `create x` inside `dev` yields `dev-x`. The prefix
  is applied to the branch _and_ the directory basename — several call sites (`goto`'s
  basename fallback, `worktreePathForBranch`) assume the two are identical — and is skipped
  when the name already carries it, so `create x` and `create dev-x` from `dev` are the same
  request. **Only the base directory resolves against the main root**, which is what keeps
  the worktrees folder flat: `dev-x` is a sibling of `dev`, never nested inside it, however
  long the chain (`dev` → `dev-x` → `dev-x-y`). In the main checkout current === main, so
  there is no prefix and behaviour is unchanged. Merging composes: from `dev`, running
  `claudjar worktree merge dev-x` folds the child back into its parent, since `merge` targets
  the branch checked out where it runs. `merge` **keeps** the worktree by default; `--remove`
  (or a later `claudjar worktree remove dev-x`) retires it.

  `claudjar goto <name>` switches between worktrees: it resolves `<name>` against
  `git worktree list` (branch first, then directory basename; the reserved `main` returns to
  the original checkout) and starts a fresh interactive `claude` there. Switching is a
  launch, not a `cd`, because a process cannot move its parent shell — and launching is what
  makes the target's SessionStart hook run, so the new session gets that worktree's stamped
  identity and `PROJECT_PORT`. It resolves from the main worktree, so it works the same from
  the main checkout and from inside any worktree.

- **`<project>/.claude/.jarrin.local.yml`** (optional, **gitignored**) is a per-machine
  override merged over the committed `.jarrin.yml`. **Only the `worktree:` block is
  overridable** — every other key is taken from the committed base verbatim (declaring
  `rules` / `commands` / `backup` here has no effect; that is deliberate, they are shared
  config). Widen the override surface explicitly in `src/config/merge.ts` if a future key
  needs it. The SessionStart hook and the statusline read the merged view (base + local),
  because the per-worktree `project:` stack needs the local file's stamped
  `worktree.name` / `worktree.port`; rules, commands, and `backup` still resolve from the
  committed base alone.

`claudjar info` prints the merged, resolved view of all of the above for the current repo:
config files present, rules with on-disk presence, the command table, the `project:` stack,
backlog methods,
worktree config, backup, and available skills.

### The service (`claudjar service`, `/etc/claudjar.conf`)

The long-lived per-user daemon behind the web interface lives in `src/service/`. Its config,
`/etc/claudjar.conf` (`CLAUDJAR_CONF` overrides), is the one config here that **fails
loudly** — `parseConf` throws a `ConfError` listing every problem, unknown keys included —
because a service silently running with no projects or as the wrong user is worse than one
that refuses to start. Keys: `projects_dir` (absolute), `user` (never root), optional
`monitor.url` + `monitor.token` (both required once `monitor:` is set).

Discovery is IO (`scanProjectsDir`) feeding a pure classifier (`discoverProjects`): a project
is a direct child whose `.git` is a **directory**; linked worktrees (`.git` is a file) and
`<repo>-worktrees/` folders are excluded. State lives in the run-as user's
`~/.claudjar/service/state.json` (`JARRIN_SERVICE_DIR` overrides); a rescan re-derives the
project list from disk and carries over only what disk cannot tell (`active`, `sessions`).

`open-project` / `close-project` drive the session state machine in `src/service/sessions.ts`:
open marks the project active and starts (or adopts) its session through the launcher; close
stops it and clears the flag; a failed start or stop leaves the state untouched. On start the
service reconciles recorded sessions against the launcher's list — still running is
re-adopted, gone is marked `stopped` — and leaves the `active` flags alone, which is what
survives a restart. Session names follow `src/session/names.ts`: label `<project>` or
`<project>/<worktree>`, launcher name with `/` → `--` (neither backend accepts `/`).
`claudjar attach` reads the same state file and resolves either spelling.

**Workspace trust** (`src/session/trust.ts`). A background session needs its cwd trusted
by Claude Code (`projects["<path>"].hasTrustDialogAccepted` in `~/.claude.json`, inherited
from any ancestor), or `claude --bg` fails at once. claudjar never trusts a checkout nobody
trusted: the service wraps its launchers in `requireTrust`, so starting in an untrusted
workspace fails up front with "run `claude` there once". The one write is inheritance:
`createWorktree` marks a new worktree trusted when the checkout it was cut from is, since a
sibling path inherits nothing. That write is a read-modify-write under `proper-lockfile`
with a temp-file rename, because live sessions write the same file.

`service install` renders a **system** unit with `User=` (`src/service/unit.ts`) and keeps
the default `KillMode` on purpose: the session launcher already puts every spawn in its own
`systemd-run --user --scope`, so sessions survive a unit restart. That scope needs the
user's systemd manager, so the unit sets `XDG_RUNTIME_DIR`, and `service status` reports
linger.

**The host channel.** With `monitor:` set, `src/service/link.ts` dials the monitor's
`/ws/host` (outbound, so no inbound port) and speaks the `HostMessage` / `ServerHostMessage`
half of `monitor/shared/protocol.ts`: `host-hello` (token + projects), `projects` after a
rescan that changed them, `project-state`, `project-detail`, and `command-result` for each
`command` (`open-project` / `close-project` / `refresh-project` / `create-worktree`). It keeps no outbound queue on purpose: the monitor
needs the _current_ list, which every reconnect's hello carries, and it fails a command whose
host dropped itself. `monitor.token` is required by `parseConf`, because the monitor rejects
every process without `NUXT_AGENT_TOKEN`. On the monitor, browsers authenticate by OIDC
(`server/utils/oidc.ts`, nuxt-auth-utils) and processes by that token
(`server/utils/auth.ts`); `/ws/watch` checks the session in its upgrade hook, since the HTTP
middleware never sees a WebSocket upgrade.

**Project tabs.** An active project gets its own tab in the monitor, filled by a
`project-detail` the host collects on `open-project` and on every `refresh-project` (the UI
sends one each time the tab is shown). `src/service/detail.ts` is pure over `DetailDeps`
(git, the stamped config, the forge — `fakeDetailDeps` in tests): the backlog repo's open
milestones with issue counts (via `giteaClient(...).openMilestones()`, credentials from
`resolveAuth` exactly as `claudjar loop` resolves them), and each checkout from
`git worktree list` with its stamped `name` / `port` / `milestone` and the status of the
service's session there. A forge failure is carried in `error` rather than failing the
command, so the worktrees still show. The hub keeps a detail only while its project is active
(closing or losing the project drops it, with `project-detail-removed`) and persists it like
hosts. The project tab's `? n` badge sums the unanswered questions of the loops matched to its
worktrees (`projectOpenQuestions`). A worktree's loops are matched in `loopsFor`: by its `loopPid` (the loop the service
started there) on the same host, else by host + repo + its linked milestone title.

**Creating worktrees.** `create-worktree { project, name?, milestone?, mode }` is handled by
`src/service/worktrees.ts`, which is pure over `CreateDeps` (`fakeWorktreeDeps` in tests).
`planCreate` validates everything before anything is created: the project must be open, a
loop needs a milestone and a backlog repo, and the name defaults to `worktreeNameFor(title)`
(shared, so the UI's placeholder matches). A milestone that is already worked is refused at
this point, whether by a live recorded loop or by a live holder of the loop's own
`milestone-<id>.lock`. The check runs again after the minutes-long create, because the loop's
lock alone would only refuse once a worktree had been made for nothing. Then
`createWorktree` (the Stage 3 library) runs from the main checkout, with the milestone
stamped, and one of two things starts in the new worktree:

- `mode: "loop"`: `spawnLoop` (`src/service/spawn-loop.ts`) runs `claudjar loop <id> --repo
--monitor` detached under `systemd-run --user --scope`, with the token in the env. Scope
  mode execs in place, so the spawned pid _is_ the loop's monitor `pid`, and the
  `LoopRecord` in `state.json` pins the worktree to that instance via
  `WorktreeDetail.loopPid`. It waits ~2 s so a loop that dies at once (lock, credentials) is
  reported with its log's tail, rather than leaving a dead pid behind.
- `mode: "session"`: a launcher session labelled `<project>/<worktree>`.

Dead loops are pruned on service start. The hub gives this command (and merge / remove)
15 minutes instead of 60 s (`commandTimeoutMs`), because setup, hooks and stack teardown run
inside it.

**Managing worktrees.** `stop-loop`, `resume-loop`, `merge-worktree { remove }` and
`remove-worktree` (all `{ project, worktree }`) are handled by `src/service/manage.ts`. It is
pure over `ManageDeps`, with `fakeWorktreeDeps` covering its part in tests. Every guard runs
before anything changes:

- A loop counts as running when it is the recorded pid (alive), the pinned `loopPid`, or a
  live holder of the loop's worktree lock.
- A session counts as running only if the launcher still lists it.
- A merge goes into `parentCheckout`: the worktree whose stamped name is the longest `<name>-`
  prefix, else the main checkout. It is refused while a loop or session runs, or while either
  tree is dirty. It passes `abortOnConflict` to the Stage 3 `mergeWorktree`, so a conflict is
  `git merge --abort`ed and reported with its files, not left in a checkout nobody stands in.
- A remove first refuses a dirty tree if nothing runs there. Otherwise it stops the session
  and SIGTERMs the loop (`stopLoopProcess`, which waits and never SIGKILLs, since that would
  skip the stash), then checks for a dirty tree again before it calls `removeWorktree`.
- `resume-loop` takes the milestone id from the loop record, else looks the stamped title up
  in the open milestones.

**Loop abort.** `ControlAction` has `stop`. The loop, and a first SIGINT / SIGTERM, abort
the same way:

- The runner's `AbortSignal` SIGTERMs `claude -p`.
- The driver (`store.stopped()`) stashes the work, leaves the issue `working` with
  `stashed: true`, and returns `aborted`. `restartPrompt(issue, stashed)` then tells the
  resumed session to pop the stash.
- `claudjar loop` reports status `aborted` (`ABORTED_STATUS`), releases its locks and does
  not push. A second signal exits at once with status `interrupted`.

### The standalone binary

`pnpm run build` produces two artifacts: `dist/claudjar.cjs` (the bundle) and
`dist/build/claudjar` (a **standalone executable**, ~118 MB, built by
`scripts/build-binary.mjs`). `claudjar install` symlinks the executable to
`~/.local/bin/claudjar`, and `claude/settings.json` calls that path for both the statusline
and the SessionStart hook. There are no launcher scripts any more — the retired
`bin/claude/` shims and the `~/.claude/bin` symlink are removed by `install` when it finds
them.

Two consequences shape the build:

- **The bundle is CommonJS, not ESM.** Node's SEA loader runs an embedded main through the
  CommonJS loader; an ESM entry dies with "Cannot use import statement outside a module".
  That is why `src/cli.ts` uses `void run(...)` instead of top-level await (inexpressible in
  CJS) and why repo-root discovery goes through `src/selfpath.ts` instead of
  `import.meta.url` (unavailable in CJS). The source stays plain ESM so `tsx src/cli.ts`
  still works in dev.
- **`claudjar --version` is baked at build time** from `project.dist.version` via tsup's
  `define`, so the binary can never disagree with the config `release` bumps. Running from
  source reports `0.0.0-dev`, which is the honest answer for an unbuilt tree.

Because a missing binary breaks the statusline and the hook in _every_ repo,
`claudjar install` offers to build it rather than only warning, and `pnpm run ensurepath`
(`scripts/ensurepath.mjs`) checks for a build first, offers to make one, then delegates to
`install`. It stays a plain node script because it must work when nothing is built yet.

### The public / internal command split

The route tree is built by `buildRoutes(hideInternal)` in `src/routes.ts` — a factory, not a
constant, so the same tree renders two ways. Everything Claude Code invokes rather than a
person lives under **`claudjar api`** (`session-start`, `statusline`), marked with stricli's
`hideRoute` so it stays out of the default help. Hidden is not disabled: `claudjar api --help`,
`--helpAll`, and `help --full --include-internal` all reach it, and `claude/settings.json`
calls it as `claudjar api session-start` / `claudjar api statusline`. Each internal command's brief starts with
`[internal]` and its `fullDescription` says why not to run it by hand.

**`claudjar help --full`** renders every command's help into one Markdown document via stricli's
own `generateHelpTextForAllCommands`, so the output cannot drift from the real flags. Because
that helper skips hidden routes, `--include-internal` works by building a _second_ application
from the same factory with `hideInternal: false` — which is the whole reason `buildRoutes` takes
a parameter instead of being a top-level constant. A test pins that the two views differ only in
the `api` routes.

That command generates the **`claudjar` skill's** command reference
(`claude/skills/claudjar/references/commands.md`). The skill exists so that a session in _any_
repo reaches for `claudjar worktree create` instead of a bare `git worktree add` — which would
produce a worktree with no copied `.env`, no `PROJECT_PORT`, no stamped identity, and no setup
run. After changing any command's flags or docs, regenerate it:

```sh
claudjar help --full > claude/skills/claudjar/references/commands.md
```

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
