---
name: claudjar-monitor
description: Reference for the claudjar monitor — the web app at claudjar.jarrin.nl (source in jarrin-claude's `monitor/`) that every `claudjar loop` reports to and that stores the loop's progress, open questions, pause/resume and input. Use this whenever the user asks about the loop's "monitor", "dashboard", "progress tree", "open questions", "answer a loop question", "pause the loop", "send input to the loop", "loop notifications", "CLAUDJAR_MONITOR_URL", or wants to change, debug, test, or (re)deploy the monitor ("deploy the monitor", "make it live on the homeserver", "the monitor is down", "add a feature to the loop UI", "change the loop protocol").
version: 0.1.0
---

# claudjar monitor

`claudjar loop` keeps no state of its own any more. A Nuxt 4 app, deployed as the homeserver's
`claudjar` stack at <https://claudjar.jarrin.nl>, does two jobs. It is the **live view** of
every loop, and it is the loop's **durable store**: each milestone's progress board, the open
questions and their answers, pause/resume, and user input. Read this before you touch either
side, because the CLI and the server share one wire protocol.

## Using it

- Loops need `CLAUDJAR_MONITOR_URL` (e.g. `wss://claudjar.jarrin.nl`) or `--monitor <url>`.
  Without it, `claudjar loop` refuses to start. Before working anything, it waits for the
  monitor's `welcome`, which carries the stored state.
- `CLAUDJAR_MONITOR_TOKEN` must match the server's `NUXT_AGENT_TOKEN`, which comes from
  `CLAUDJAR_MONITOR_TOKEN` in the homeserver's `~/.server.env`. It is **mandatory**: with no
  token configured, the monitor rejects every loop (`/ws/agent`), service (`/ws/host`, token
  in `/etc/claudjar.conf` as `monitor.token`) and live-log post (`/api/live`).
- Browsers log in via OIDC against auth.jarrin.nl (client `claudjar`, callback fixed at
  `/auth/callback`; changing it means changing `redirect_uris` in the stack template). The
  whole UI and `/ws/watch` need the session; `/healthz` and `/auth/*` are public.
- The **projects** tab lists every machine running `claudjar service` with its projects, and
  sends it `open-project` / `close-project`. Each active project gets its own tab: open
  milestones of its backlog repo and its worktrees (port, linked milestone, session, linked
  loop), sent by the host as `project-detail` on open and on `refresh-project` (sent each time
  the tab is shown). Closing the project removes the tab. From the tab, `create-worktree`
  makes a worktree on the host. **New worktree + loop** on a milestone starts a detached
  `claudjar loop` for that milestone, and the worktree is pinned to it by `loopPid`. **New
  worktree**, with a name and an optional milestone, starts a background session
  `<project>/<worktree>`. A milestone that already has a loop is refused.
- Each worktree row (and the tab of the loop working it) has state-gated actions, handled in
  `src/service/manage.ts`. Merge, merge & remove, and remove ask for confirmation first.
  - `stop-loop` SIGTERMs the service's loop. A loop started by hand is aborted with the
    `control` action `stop` instead.
  - `resume-loop` restarts `claudjar loop` on the worktree's linked milestone.
  - `merge-worktree` merges into the checkout the worktree was cut from. It is refused while
    a loop or session runs there or either tree is dirty, and a conflict is aborted.
  - `remove-worktree` stops what runs in the worktree, tears its stack down, runs the remove
    hooks and removes it.
- The UI has one tab per loop process. The log is on the left. On the right, a panel that
  scrolls on its own holds the progress tree and the open questions, each with its own answer
  box; an unanswered question moves above the tree. On a phone the panel stacks under the log.
  A loop tab, the tab of the open project whose worktree it works, and that worktree's row all
  carry a `? n` badge for unanswered questions (`openQuestionsOf`, `projectOpenQuestions`). Below them are
  **Pause/Continue**, **Abort** and **send input**. Browser desktop notifications have to be enabled once
  with the header button. They fire on a new question, an issue turning blocked, and a loop
  that finishes or stops.
- Pause is graceful: the running session finishes and no new one starts. Abort (`control`
  `stop`, or a first SIGTERM / Ctrl-C to the loop) ends the running session instead. It
  stashes the session's work, keeps the issue `working` with `stashed: true` so a restart
  resumes the session and pops the stash, reports status `aborted` and exits. Input goes into the
  running session mid-turn. If no session is running, it is prepended to the next prompt.
- Don't start a loop yourself (see the `claudjar` skill). Give the user the command instead.

## Where things live

| Concern | File |
| --- | --- |
| Wire protocol: dependency-free types shared by CLI and server | `monitor/shared/protocol.ts` |
| Server-side validation (zod mirror of the protocol, plus the saved-state schema) | `monitor/server/utils/schema.ts` |
| Server state: instances, boards, questions, fan-out | `monitor/server/utils/hub.ts` |
| Persistence (`$NUXT_DATA_DIR/state.json`, debounced and atomic) | `monitor/server/utils/store.ts` |
| WebSocket routes: `/ws/agent` (loops), `/ws/host` (services) and `/ws/watch` (browsers) | `monitor/server/routes/ws/` |
| Auth: path policy, token check, browser gate (pure, tested); the OIDC flow; the HTTP middleware | `monitor/server/utils/auth.ts`, `monitor/server/utils/oidc.ts`, `monitor/server/middleware/auth.ts`, `monitor/server/routes/auth/` |
| Service-side host client (project publishing, commands) | `src/service/link.ts`, wired in `src/service/run.ts` |
| Gitea webhooks: `/api/webhook/gitea` (signature check, `NUXT_WEBHOOK_SECRET`) → `Hub.forgeEvent` → `forge-event` to hosts on that backlog repo → the service's todo watcher | `monitor/server/routes/api/webhook/gitea.post.ts`, `monitor/server/utils/webhook.ts`, `src/service/todo.ts` |
| UI state folding + notification rules (pure, tested) | `monitor/app/utils/instances.ts` |
| UI | `monitor/app/app.vue`, `monitor/app/components/` |
| Log entries: one component per tool / line kind, all rendering through the base `log/LogRow.vue` (time, issue, icon, action, title, `inline-result` slot, collapsible body). `log/registry.ts` maps a route from `utils/tools.ts` (`routeTool`: built-in kind, `mcp/<server>/<resource>/<verb>`, then `mcp/gitea`, `mcp`, `default`) to its component — add a tool by adding a route and a component | `monitor/app/components/log/` |
| Gitea result shapes (zod, from gitea-mcp's `slim*` helpers) and forge links (`InstanceInfo.forge` + `useForge`) | `monitor/app/utils/gitea.ts`, `monitor/app/utils/forge.ts` |
| Live tail of a Bash call's `> file` redirect (`tail` lines, ended by `system/task_notification`) | `src/loop/tail.ts`, `monitor/app/components/log/LiveTail.vue` |
| **Live logs** tab: every file a Bash call writes to, from plain sessions and loops. Plain sessions stream via the async `PreToolUse` hook `claudjar api live-log` (registered in `claude/settings.json`; follows the file until no process holds it open for writing, per `/proc`, and POSTs chunks to `/api/live`). Loop sessions get `CLAUDJAR_LOOP=1` so the hook stands down; the hub mirrors the loop's `tail` lines instead. Not persisted | `src/commands/live-log.ts`, `src/live/follow.ts`, `monitor/server/routes/api/live.post.ts`, `Hub.livePost` in `hub.ts`, `monitor/app/components/LiveLogs.vue` |
| Loop-side client (implements the driver's `LoopStore`) | `src/loop/monitor.ts` |
| Live input into a session (stdin stream-json) | `src/loop/input.ts`, `src/loop/runner.ts` |
| Driver: questions, pause, restart logic | `src/loop/driver.ts`, `src/loop/progress.ts` |

## Changing the protocol

1. Edit the types in `monitor/shared/protocol.ts`. Keep the file import-free, because the CLI
   bundles it.
2. Mirror every change in the zod schemas in `schema.ts`. The `satisfies z.ZodType<…>`
   annotations make tsc flag any drift.
3. Handle the message in `hub.ts` and the route, then in `src/loop/monitor.ts` (agent side) or
   `app/utils/instances.ts` (browser side).
4. Anything persisted becomes part of `Saved`. An old `state.json` that fails the new schema is
   moved aside as `state.json.corrupt-<ts>` and the server starts empty. Prefer optional or
   defaulted fields so existing state stays readable.

Keep these invariants:

- **The loop never fails because of the monitor.** Outgoing messages queue while the socket is
  down. Asks and resolves are re-sent on every reconnect, and the server dedupes them by
  question id.
- **Boards and questions are keyed by repo + milestone id, not by instance.** A restarted loop
  is a new instance and has to find the old state.
- **Order matters on an answer.** Mark the entry `working`, then send `resolved`, then resume.
  If the loop crashes in between, the restart resumes the session instead of waiting on a
  question that is already closed.
- **Snapshots never notify.** Only incremental messages raise browser notifications.

## Verifying

- `pnpm -C monitor check` runs lint, typecheck, Vitest and build. The root `pnpm check` chains it.
- End-to-end without real Claude sessions: run the built server with
  `PORT=3911 NUXT_DATA_DIR=<scratch> NUXT_AGENT_TOKEN=<t> node monitor/.output/server/index.mjs`
  (the token is mandatory; add `NUXT_OIDC_*` + `NUXT_SESSION_PASSWORD` to exercise the login,
  plus `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt`, since auth.jarrin.nl is
  signed by the Caddy internal CA). A browser-side socket then needs a `nuxt-session` cookie
  sealed with that password (iron-webcrypto `seal` of `{ id, createdAt, data: { user } }`);
  `nuxt dev` without `NUXT_OIDC_*` skips the login instead. Then drive
  `connectMonitor` from a `.mts` script with `pnpm exec tsx`, plus a raw `WebSocket` to
  `/ws/watch` acting as the browser. A `.ts` script fails, because tsx compiles it as CJS
  and rejects top-level await.
- Look at the UI at `http://localhost:3911` after seeding an instance that stays connected.
  For layout work, script it: a raw `WebSocket` to `/ws/agent` (hello + a long `progress` +
  an `ask`) and one to `/ws/host` (`host-hello` + a `project-detail`), then Playwright
  (installed in a scratch dir, not in `monitor/`) to screenshot and compare an element's
  `scrollHeight` with its `clientHeight` at desktop and phone widths.
- **Scrolling columns are flex, not grid.** A `grid` with a fixed height shrinks its rows to
  fit, and a `UCard` (`overflow-hidden`) then clips its content instead of the column
  scrolling. Use `flex flex-col overflow-y-auto *:shrink-0` for the aside and the project view.

## Deploying

Run `pnpm -C monitor run deploy` (`monitor/deploy/deploy.sh`). It builds the image, pushes it to
`zot.jarrin.nl/claudjar-monitor:latest`, copies `docker-compose.template.yml` to
`~/server-new/stacks/claudjar/` on the homeserver (`jarrin@10.0.0.2`), pulls, and restarts the
stack. State lives in the named `data` volume, mounted at `/data`, so it survives a redeploy.
After deploying:

- `curl -s https://claudjar.jarrin.nl/healthz` should print `ok`.
- If the site is new, reload Caddy: `./homeserver restart networking:caddy` on the server.
- Rebuild and reinstall the CLI if the protocol changed (`pnpm run ensurepath`). A loop
  binary on an older protocol is rejected by the server's validation.
- The login's server-side calls trust the Caddy internal CA through `mount_host_certs` +
  `NODE_EXTRA_CA_CERTS` in the template; without them discovery fails with
  `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.
