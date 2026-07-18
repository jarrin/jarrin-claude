---
name: staged-planning
description: Jarrin's required workflow for ANY request to "create a plan" (or "make a plan", "plan out X"). Plans are always split into stages, persisted through the backend configured per-repo in .claude/.jarrin.yml under the `backlog.plan` section — local files under .claude/plans/, or milestone-grouped issues on a git forge — and executed ONE stage at a time: stop after every stage, report, and wait for the user to continue in fresh context. Read and follow this whenever the user asks for a plan, or uses a "Continue …" verb to resume one — "Continue plan", "Continue plan-<slug>" for a named plan, or "Continue 1234" for a named ticket. Also owns "migrate plan-<slug>": moving an existing plan to the currently configured backend.
version: 0.5.0
---

# Staged Planning (Jarrin's workflow)

This is Jarrin's leading, machine-wide workflow for planning work. Whenever the user
asks you to **create / make / write a plan** for something, or says **"continue plan"**,
follow this exactly. It applies in every project and repo unless the user overrides it
for a specific request.

Where a plan is persisted is chosen per-repo in `.claude/.jarrin.yml` under `backlog.plan`;
this skill parses that block itself — the jarrin `SessionStart` hook cannot, since nested
keys are outside its YAML subset.

`~/.claude/references/backlog.md` is the single source of truth for config resolution,
labels, milestones, ticket bodies, retrieval, and the silent API traps. Read it before the
first forge call; this skill points at it rather than restating it.

## The golden rule

**NEVER continue to the next stage on your own.** After finishing a stage you stop
completely and wait for the user to clear context and explicitly say "Continue plan".
There are no exceptions — not "the next stage is trivial", not "it's clearly implied",
not "to save a round-trip". Stop means stop. This holds for every method.

## 1. Resolve the config

Read `<repo-root>/.claude/.jarrin.yml` and resolve the `backlog.plan` section per **§1 of
the reference** — defaults, `repo` inheritance, and the fail-loudly rule live there.

```yaml
backlog:
  repo: owner/name       # home repo; shared default for both sections
  plan:
    method: local        # local (alias: repo) | gitea | github | gitlab   (default: local)
    assignee: claude     # forge methods only
    repo: owner/name     # optional override of backlog.repo
    dir: .claude/plans   # local method only (default: .claude/plans)
```

No `backlog:` block, or no `plan:` section → `method: local`, `dir: .claude/plans`. A forge
method with no `repo` anywhere → stop and ask which `owner/name` to file against.

### Stranded-work check

Resolving the method is also where **reference §8** runs: switching a method does not move
the work already filed, it hides it. Check the backend the config does *not* name — the
**plan side only**, never `backlog.todo`. One stat or one label query; never a sweep.

- **Configured forge** → stat `<dir>/current.md`. Resolve `dir` even under a forge method
  (default `.claude/plans`); it is local-only for *writing*, not for this check. Stranded
  when the file exists **and** its `**Status:**` is not `plan complete` — §7 leaves a
  finished plan on disk until the user confirms deletion, so existence alone proves nothing.
- **Configured `local`** → the §6 candidate query: stranded when an open `plan-*` milestone
  has **≥ 1 open `stage` ticket**. Reuse that rule verbatim rather than inventing a second
  one. Never `open_issues > 0` — caveat tickets count toward it, so a finished plan trips it.

**Silent when there is nothing.** When there is: do the user's actual request first, then
report the strand in **one line** — which plan, and which backend still holds it. It is a
line of report, never a question, and never gates the request. Migrate only when the user
explicitly asks, per **reference §8**; a Continue verb never implies it.

Best-effort: no resolvable `repo`, or no MCP → skip the check silently and carry on. That is
not the forbidden silent fallback — skipping an advisory check leaves the request untouched.

### Worktree scoping

Also read `worktree.name` from `<repo-root>/.claude/.jarrin.local.yml` (best-effort; missing →
the main worktree). When set, a `gitea` plan is scoped to that worktree per **reference §9**:
every stage / caveat / cleanup / gotcha ticket created carries the `worktree/<name>` label, and
plan selection, the Continue verbs and the stranded check filter by it (`worktree/<name>` added
to the `labels`; main drops rows carrying a `worktree/*` label). `local` plans are already
per-directory, so scoping is a `gitea` concern only.

## 2. The plan is the same object in every method

Only the persistence differs. A plan always has an overview, **ordered stages** that are
each independently completable and end at a natural stopping point, each with steps and a
**Done when**, plus notes carried forward to the next fresh-context session.

| Plan part            | `local`                              | `gitea`                                          |
| -------------------- | ------------------------------------ | ------------------------------------------------ |
| overview             | `## Overview` in `plan-<slug>.md`    | the milestone description                        |
| a stage              | `### Stage <n> — <title>` + steps    | issue `Stage <n> — <title>`, labelled `stage`     |
| which stage is current | `current.md`                       | lowest open `stage` ticket, by parsed `<n>`      |
| carried-forward notes | `current.md` notes section          | outcome comment on the closed stage ticket       |
| caveat / cleanup / gotcha | a note in `current.md`          | its own ticket on the same milestone             |

There is exactly one active plan at a time. For `method: gitea` the **forge is the sole
source of truth** — no `plan-<slug>.md`, no `current.md`; writing both would give the plan
two states that drift apart.

## 3. When the user asks to CREATE a plan

1. Understand the goal (ask clarifying questions first if it is underspecified).
2. Pick a short kebab-case slug of the goal (e.g. `add-oauth-login`).
3. Persist it via the resolved method (§4).
4. **Do NOT start executing yet unless the user asked you to.** Present the staged plan
   and let the user confirm. (If the user asked you to create *and* begin, you may then
   execute Stage 1 — and only Stage 1.)

## 4. Route to the method

### `local` — markdown under `.claude/plans/`

Everything lives in the resolved `dir` in the current project's root (create it if it does
not exist — do not use the home `~/.claude/plans/` folder, that is Claude Code's own
plan-mode storage).

- `<dir>/plan-<slug>.md` — one file per plan.
- `<dir>/current.md` — the pointer file: which plan is active, and which stage is current.

Write `plan-<slug>.md`, then overwrite `current.md` pointing at it with the current stage
set to **Stage 1** and status `not started`.

```markdown
# Plan: <goal>

## Overview
<1–3 sentences on the goal and approach>

## Stages
### Stage 1 — <title>
- [ ] <step>
- [ ] <step>
**Done when:** <clear completion criterion>

### Stage 2 — <title>
...
```

```markdown
# Current plan
- **Plan:** plan-<slug>.md
- **Current stage:** Stage <n> — <title>
- **Status:** not started | in progress | stage complete | plan complete
- **Last updated:** <YYYY-MM-DD>

## Notes / caveats carried forward
<anything the next fresh-context session needs to know>
```

### `gitea` — a `plan-<slug>` milestone of stage tickets

Load the tools in one call:

```
ToolSearch select:mcp__gitea__label_read,mcp__gitea__label_write,mcp__gitea__milestone_read,mcp__gitea__milestone_write,mcp__gitea__issue_read,mcp__gitea__issue_write,mcp__gitea__list_issues
```

Then, against the resolved `owner/name`, in this order — `issue_write` needs both the
labels and the milestone as **numeric IDs**, so they must exist first:

1. **Labels** (§3) — `label_read list_repo_labels`, create only the names that are missing,
   and resolve `stage` + `plan-<slug>` + `claude` to IDs. Never blind-create:
   `create_repo_label` silently duplicates an existing name.
2. **Milestone** (§4) — resolve `plan-<slug>` with the overview as its description.
   `milestone_read list` narrows by **substring**, so match `title ==` exactly client-side;
   apply the collision policy (one open match → reuse; none → create; two or more → suffix
   `-2`, `-3`). The `plan-<slug>` **label name must carry the same suffix as the milestone
   title**, or the index and the grouping diverge.
3. **Stage tickets** (§5) — one `Stage <n> — <title>` issue per stage, **created in stage
   order**, labelled `stage` + `plan-<slug>` + `claude` (as IDs) — plus `worktree/<name>` in a
   named worktree (§9) — on the milestone ID, assigned to `backlog.plan.assignee` when set. The
   body carries the §5 **Request** / **Scope** lines, the steps as a checklist, and **Done when**.

**Re-running must be safe.** A half-created plan is resumed, not duplicated: fetch
`list_issues(labels: ["plan-<slug>", "stage"], state: "all")` first and skip any stage
whose title already exists.

### `github` / `gitlab`

Shape-only: neither MCP is connected today. Say the configured method's MCP is unavailable
and stop. **Never** fall back to files silently — the user asked for a forge, and quietly
writing markdown hides that it failed.

## 5. Executing a stage

Either just after creation if asked, or after a "Continue plan". Do the work for **that one
stage only**, then record it and stop.

### Finding the current stage

- `local` — read `current.md`.
- `gitea` — the plan's open `stage` tickets are
  `list_issues(labels: ["plan-<slug>", "stage"], state: "open")`; the current stage is the
  **lowest parsed `<n>` from the `Stage <n> — <title>` title** (§6). Never order stages by
  issue number — caveat and cleanup tickets interleave. Read the ticket body for the steps;
  read the closed stage tickets' comments for what was carried forward.

### Recording the outcome

- `local` — tick the stage's checkboxes in `plan-<slug>.md`; update `current.md` (mark the
  stage complete, and record caveats, decisions, and blockers under "Notes / caveats carried
  forward" so the next fresh-context session has what it needs).
- `gitea` — `issue_write add_comment` on the stage ticket with the outcome and anything
  carried forward, then `issue_write update` it to `state: "closed"` (§7). Comment first:
  the comment is the carried-forward note, and closing without it loses the handoff.

### Caveats, cleanups and gotchas found mid-stage

- `local` — note them in `current.md`.
- `gitea` — file each as its own ticket on the **same milestone**, labelled `caveat` /
  `cleanup` / `gotcha` + `plan-<slug>` + `claude`, body per §5.

They are **parallel follow-ups: they do not block the next stage.** The milestone stays open
while any remain. If one genuinely blocks progress, that is not a caveat — say so in the
report and stop.

### Then STOP

Report to the user:

- What was done in this stage.
- Any caveats, surprises, or deviations (and the ticket numbers, for `gitea`).
- Whether it can continue, or is blocked (and why, if so).
- Then tell the user they can clear context and say **"Continue plan"** to proceed.

Do not touch the next stage.

## 6. The "Continue …" verbs (fresh context)

Each verb resolves to **one** unit of work; you then execute it per §5 — do the work, record
the outcome, stop. Resolve the config (§1) first. For `gitea`, selection, ordering and
scoping are specified in **reference §6** — follow it rather than re-deriving it: the
ordering trap there is silent, and getting it wrong runs the wrong stage.

### "Continue plan" — the active plan's current stage

- `local` — read `current.md` for the active plan and its current stage, then that stage's
  steps from the plan file, plus the carried-forward notes.
- `gitea` — select the active plan per **reference §6** ("Selecting the active plan"): an
  open `plan-*` milestone **with at least one open `stage` ticket**. No candidate → no plan
  is in progress, say so; two or more → **ask**. Then its current stage is the **lowest
  parsed `<n>`** of `list_issues(labels: ["plan-<slug>", "stage", "claude"], state: "open")`.
  Read that ticket's body for the steps, and the closed stage tickets' comments for what was
  carried forward.

### "Continue plan-<slug>" — a named plan

The plan is given, so no selection is needed; the stage selection is unchanged.

- `local` — `<dir>/plan-<slug>.md`. If it is not the plan in `current.md`, say so and ask:
  naming a different plan is a switch, not a continuation.
- `gitea` — resolve the milestone by title per **reference §4** (`name:` narrows by
  **substring** → match `title ==` exactly client-side; two open matches → ask). Then take
  its lowest open stage as above. Two ways a named plan has nothing to run, both reported
  rather than worked around: no open milestone by that title but a **closed** one → the plan
  is finished; an **open** milestone with **zero open stage tickets** → also finished, its
  milestone merely held open by caveat tickets (reference §6). Never reopen a closed ticket
  to manufacture work.

### "Continue <number>" — a named ticket (`gitea` only)

`issue_read get` the ticket and route on its milestone per **reference §6** ("Resolving a
ticket by number"). The user named this ticket explicitly, so honour it — but say plainly
when it is not what "Continue plan" would have picked:

- A **stage** ticket with an earlier stage still open → do the named one, and flag the
  skipped stage. Never silently reorder a plan.
- A **caveat / cleanup / gotcha** ticket → do that follow-up, with its milestone's plan as
  context. It is not a stage: finishing it does not advance the plan.
- A **`todo`-milestone** ticket → a standalone todo, not plan work.
- **Already closed** → report its outcome comment; do not redo it.

### "Continue todos"

Not a plan verb — it reads `backlog.todo` and belongs to the `todo` skill. Hand off to it.

## 7. When the plan finishes

After the final stage completes, report the outcome and:

- `local` — set `current.md` status to `plan complete`, and **offer to delete** the plan
  files (`plan-<slug>.md`) and clear `current.md`. Only delete after the user confirms.
- `gitea` — every `stage` ticket is closed. Offer to close the milestone, but **only once
  `open_issues == 0`**: leftover caveat / cleanup / gotcha tickets are still real work, and
  closing over them buries it. There is no issue-delete method — tickets are closed, never
  removed.

## 8. Migrating a plan across backends

Only ever on an **explicit request** — "migrate plan-<slug>", "move the plan to gitea". The
§1 notice never implies it, and neither does a Continue verb. The **destination is always the
currently configured method** — migration follows the config rather than taking a destination
argument, because that is the backend the user chose.

Rules are specified in **reference §8 ("Migration")** — follow it rather than re-deriving.
What it turns on:

- **`local` → forge** — create per §4 / §5, reusing §5's idempotency verbatim (resolve the
  milestone, `list_issues(state: "all")`, skip titles that already exist), so a half-migrated
  plan is safe to re-run. Order stages by the **parsed `<n>`**, never by server order
  (reference §6: newest-first is *reverse* stage order).
  - **Finished stages must land closed**, or migration re-runs completed work. Finished = the
    stage precedes `current.md`'s current stage, or *is* it with status `stage complete`.
    `current.md` is the pointer of record; the ticked checkboxes are a secondary signal.
  - `current.md`'s notes section **is** the handoff (§6 reads it from closed stage tickets'
    comments): attach it as the outcome comment on the **last closed** stage ticket, or the
    lowest open one if none is closed. Do not mint caveat / cleanup / gotcha tickets out of
    it — the blob has no per-note structure, and inventing one is a guess.
  - Then **offer to delete** the local files — never silently; §7's confirm rule governs.
- **forge → `local`** — write `plan-<slug>.md` + `current.md` from the milestone and its
  tickets. This direction is **lossy**; say what is dropped rather than dropping it quietly.
  Preserved: the overview, each stage's title / steps / **Done when**, the closed stages
  ticked, and — folded into `current.md`'s notes — the closed tickets' outcome comments plus
  any open caveat / cleanup / gotcha tickets (the notes section is their local
  representation). Dropped: issue numbers, comment threads, authorship, timestamps, and the
  **goal title** — a forge stores only `plan-<slug>` and the overview, so `# Plan: <goal>`
  degrades to `# Plan: <slug>`.
  - There is **no issue-delete method**: close each migrated ticket with an outcome comment
    naming where the work went (`migrated to .claude/plans/plan-<slug>.md`). Folding the
    caveats in is what lets the milestone reach `open_issues == 0` and become closable (§7).

Then report what moved, what was dropped, and where the plan now lives. Migration is **not a
stage**: it does not advance the plan, and finishing it does not license starting one.
