# Backlog reference (shared)

The single source of truth for how `staged-planning` and `todo` route work to a backlog
backend. Both skills read this file; neither invents behaviour outside it.

Every rule below marked **verified** was checked against the live Gitea MCP (v1.22.6) on
2026-07-16. The traps are real and silent — read §2 before writing any code path.

## 1. Config resolution

Read `<repo-root>/.claude/.jarrin.yml` and parse the `backlog:` block yourself. The
`SessionStart` hook **cannot** read it: its stdlib YAML subset has no representation for
two-level nesting, so it ignores `backlog:` entirely. This is by design, not a bug.

```yaml
backlog:
  repo: owner/name          # home repo for forge methods; shared default for both sections
  plan:
    method: local           # local (alias: repo) | gitea | github | gitlab
    assignee: claude        # forge methods only
    repo: owner/name        # optional per-section override of backlog.repo
    dir: .claude/plans      # local method only
  todo:
    method: gitea
    assignee: claude
    dir: .claude/todo       # local method only
```

`staged-planning` reads `backlog.plan`; `todo` reads `backlog.todo`. Resolve each
independently:

| Key        | Default          | Notes                                                      |
| ---------- | ---------------- | ---------------------------------------------------------- |
| `method`   | `local`          | `repo` is an accepted alias for `local`                     |
| `repo`     | `backlog.repo`   | section value wins; **required** for forge methods          |
| `assignee` | none             | forge methods only; omit → create unassigned                |
| `dir`      | `.claude/plans` / `.claude/todo` | `local` only; ignored by forge methods      |

- **No `backlog:` block → `method: local` for both sections.** Identical to the behaviour
  before `backlog:` existed, so untouched repos keep working.
- A forge method with no `repo` (neither section nor top level): **stop and ask** which
  `owner/name` to file against. Never guess.
- `github` / `gitlab` are **shape-only** — only the Gitea MCP is connected today. If the
  configured method's MCP is not available, say so and stop. Never silently fall back to
  files: the user asked for a forge, and quietly writing markdown hides that it failed.
- **Changing a `method` does not move the work already filed** — it strands it, silently, in
  the backend that is no longer queried. Resolving a section is therefore also where its
  stranded-work check runs: **§8**.

## 2. Verified API facts — the traps

These are non-obvious and fail **silently**. Do not re-derive them.

- **`label_write create_repo_label` is not idempotent.** Creating an existing name silently
  makes a *duplicate* with a new ID (`stage` → ids 1 *and* 7). Gitea does not enforce unique
  label names. Never blind-create: list first, create only what is missing (§3).
- **`milestone_read list name:` is a substring match, not exact.** `name: plan-alpha` also
  returns `plan-alpha-2`. Use it only to narrow the fetch, then match `title == <exact>`
  client-side. Taking the first hit will eventually grab the wrong milestone.
- **Duplicate milestone titles are allowed.** Two open milestones can both be `plan-alpha`
  (§4 collision policy).
- **`list_issues` returns a trimmed issue**: `number`, `title`, `state`, `labels`, `user`,
  `created_at`, `updated_at`, `html_url`, `comments`. It has **no `assignees`, no
  `milestone`, no `body`** — even when they are set. Filtering a *list* by assignee or
  milestone is therefore impossible without an `issue_read` per issue. This is why the label
  mirror is mandatory rather than an optimisation (§3, §6).
- **`issue_read get` returns the full issue**: adds `assignees`, `body`, `closed_at`, and
  `milestone: {id, title}` when set (the key is omitted, not null, when unset).
- **`list_issues labels:` is AND, by name, server-side.** `["claude","stage"]` returns only
  issues carrying both; `["stage","todo"]` returns none. This is the cheap index — one call,
  no pagination sweep, no N+1 reads.
- **Milestones expose no creation timestamp.** Highest `id` is the only "most recent" proxy.
- **Milestone counters track**: `open_issues` / `closed_issues` update as issues are attached
  and closed, so `open_issues == 0` means every ticket is resolved.
- **A bad assignee fails loudly**: assigning a non-existent or non-collaborator user returns
  `user does not exist [uid: 0, name: …]`. No read-back verification step is needed — but the
  assignee **must be a repo collaborator**, or creation hard-fails.
- **There is no issue-delete method** (`issue_write` has no `delete`). Issues can only be
  closed. Milestones and labels *can* be deleted — but **deleted label IDs are never
  reused**, so in any repo with deletion history a new label lands on an unpredictable id
  (verified: a fresh label after one deletion got id 8, not 7). Never assume; always resolve.
- **`issue_write update` is a partial update**: passing only `state` leaves labels,
  milestone, and assignees intact. Closing a stage ticket needs no re-send of its fields.
- **Issues are authored by `jarrin`** — the MCP holds jarrin's token. Never scope by author;
  scope by assignee + the `claude` label (§6).
- **Collaborator management has no MCP tool.** Grant access via the REST API:
  `PUT /api/v1/repos/{owner}/{repo}/collaborators/{user} {"permission":"write"}` (204 = ok).
  Every new forge-method repo needs this for the assignee, or every create fails.

## 3. Labels

Six fixed labels, bootstrapped per repo; `plan-<slug>` is created per plan on demand.

| Label         | Color     | Role                                                       |
| ------------- | --------- | ---------------------------------------------------------- |
| `stage`       | `#1f6feb` | an ordered step of a plan (`Stage <n> — <title>`)           |
| `caveat`      | `#d4a72c` | constraint or surprise discovered mid-plan                  |
| `cleanup`     | `#2da44e` | tidy-up follow-up split off from a stage                    |
| `gotcha`      | `#cf222e` | trap worth flagging so it is not rediscovered the hard way  |
| `todo`        | `#8250df` | standalone backlog item, under the general `todo` milestone |
| `claude`      | `#6e7781` | scoping marker; backstop for assignee-based filtering       |
| `plan-<slug>` | `#1b7c83` | per-plan index mirror, created on demand                    |

**Bootstrap (idempotent):**

1. `label_read list_repo_labels` (`per_page: 50`) — one call, gives every name→ID.
2. Create **only** names that are absent, via `label_write create_repo_label`.
3. Build the name→ID map from the result.

**Resolution:** `issue_write.labels` takes **numeric IDs**, never names — always resolve
through the map. If a name resolves to more than one ID, the repo has duplicates from an
earlier blind create: use the lowest ID and mention the duplicate; don't fail the write.

The `plan-<slug>` label name is **always identical to its milestone title**, including any
collision suffix (§4). A milestone `plan-alpha-2` gets the label `plan-alpha-2` — otherwise
the index and the grouping silently diverge.

## 4. Milestones

The milestone groups a plan; the label indexes it. Titles: `plan-<slug>` per plan, and one
general `todo` milestone for standalone todos (create once, **never auto-close**).

**Resolve-by-title:**

1. `milestone_read list` with `state: "open"` and `name: <title>` to narrow.
2. Filter client-side for `title == <title>` **exactly** — the `name:` filter is substring.
3. Then apply the collision policy.

**Collision policy** (duplicate titles are permitted, so this is reachable):

- **Exactly one open match** → reuse it.
- **No match** → create it.
- **Two or more open matches** → **never guess.** Creating a plan: suffix `-2`, then `-3`,
  until the title is free, and use that suffix for the label too. Retrieving a plan: surface
  the ambiguity and ask which milestone is meant.

"Most recent milestone" means **highest `id`** — there is no creation timestamp. A plan's
overview text lives in the milestone `description`.

## 5. Creating tickets

Tickets live in the **home repo** (`backlog.<section>.repo`). An issue belongs to exactly one
repo, so cross-repo work is expressed in the body's **Scope** line, never by filing
elsewhere.

**Body format:**

```markdown
**Request:** <the user's ask, verbatim — not a paraphrase>
**Scope:** <repo(s) the work touches, e.g. `owner/name`; or "this repo">

<detail: context, file references, acceptance notes>

**Done when:** <completion criterion>        ← stage tickets only
```

Stage tickets additionally carry their steps as a checklist above **Done when**.

**Labels on create:**

| Ticket kind | Labels                                   | Milestone       |
| ----------- | ---------------------------------------- | --------------- |
| stage       | `stage` + `plan-<slug>` + `claude`        | `plan-<slug>`   |
| caveat / cleanup / gotcha | that label + `plan-<slug>` + `claude` | `plan-<slug>` |
| todo        | `todo` + `claude`                        | `todo`          |

Assign to `backlog.<section>.assignee` when set.

**Idempotent creation — a half-created plan must be safe to re-run:**

1. Resolve (or create) the milestone first (§4).
2. Fetch existing tickets: `list_issues(labels: ["plan-<slug>", "stage"], state: "all")`.
3. **Skip any stage whose title already exists**; create only the missing ones, in stage
   order. Re-running must never duplicate a ticket.

## 6. Retrieval, filtering and ordering

**Always start from the label** — it is the only scoping key that is both server-side
filterable and present in the list response:

```
list_issues(owner, repo, labels: ["plan-<slug>", "stage", "claude"], state: "open")
```

- **Scoping to Claude's work:** add `claude` to the `labels` array (AND). The `claude` label
  is the primary scoping key precisely because `list_issues` never returns `assignees`.
  Verifying `assignee == backlog.<section>.assignee` requires an `issue_read` per issue — do
  that only for the handful of candidates the label filter already narrowed to, never as a
  sweep.
- **Pagination:** `per_page` defaults to 30. Pass it explicitly and page until a short page
  comes back; never assume one page is everything.

### Ordering

`list_issues` returns **newest first**. Sorting is mandatory, not defensive — but the key
differs by ticket kind:

- **Stages: sort on the parsed `<n>`** from the `Stage <n> — <title>` title. Never on issue
  number (caveat and cleanup tickets interleave), never on server order — newest-first is
  *reverse* stage order, so taking the first hit lands on the **last** stage. Verified: a
  plan's open stages came back `#6, #5` — first hit = Stage 3, correct answer = Stage 2 (#5).
- **Todos: sort on issue number, lowest first.** They carry no stage numbering, so creation
  order *is* queue order. The key differs from stages; the newest-first trap does not.

### Selecting the active plan

**`open_issues > 0` does not mean a plan has stages left.** Caveat / cleanup / gotcha tickets
count toward the counter, and §7 deliberately keeps a milestone open while any remain — so a
**finished** plan keeps an open `plan-*` milestone indefinitely. Verified: `plan-pilot` reads
`open_issues: 3` = 2 open stages + 1 caveat. Selecting on highest id alone would resume a
finished plan and find nothing to do.

A milestone is a **candidate** only if it is open, titled `plan-*` (the general `todo`
milestone is not a plan), **and has at least one open `stage` ticket**:

1. `milestone_read list` with `state: "open"` and `name: "plan-"` — narrows to the plan
   milestones server-side and drops the `todo` milestone (verified). `name:` is a
   **substring** match (§2), so still confirm the `plan-` **prefix** client-side: it would
   equally match `replan-x`.
2. One `list_issues(labels: [<title>, "stage", "claude"], state: "open")` per surviving
   milestone — the label mirror shares the milestone's exact title (§3), so the two agree
   by construction. Keep only the milestones that return a non-empty list.

Then:

- **No candidate** → no plan is in progress. Say so; never invent one. Mention any open
  caveat / cleanup / gotcha tickets — they are still real work.
- **Exactly one** → that is the active plan.
- **Two or more** → two plans are genuinely in flight, breaking the one-active-plan
  invariant. **Ask** which to continue, listing them most-recent first. Never guess: guessing
  costs a full stage of work on the wrong plan, asking costs one round-trip.

"Most recent" means **highest `id`** — there is no creation timestamp (§2). It orders the
question; it does not decide it.

### Resolving a ticket by number

Use `issue_read get`, never `list_issues` — the list response carries no `milestone` and no
`body` (§2). Route on the milestone:

| Ticket's milestone | Meaning                                                 |
| ------------------ | -------------------------------------------------------- |
| `plan-<slug>`      | part of that plan — its description holds the overview   |
| `todo`             | a standalone todo — there is no plan context to load     |
| absent             | a bare issue — treat it on its own terms                 |

Read `issue_read get_comments` too: on a closed stage ticket the outcome comment **is** the
carried-forward note (§7). A closed ticket is already resolved — report its outcome rather
than redoing the work.

## 7. Resolution

- Finishing a stage **closes its ticket** (`issue_write update`, `state: "closed"`) with an
  outcome comment (`add_comment`) recording what was done and anything carried forward.
- Caveat / cleanup / gotcha tickets are **parallel follow-ups**: they do **not** block the
  next stage. The milestone stays open while any remain.
- The `todo` milestone is permanent — never auto-close it, even at `open_issues == 0`.

## 8. Switching methods — stranded work

Changing `backlog.<section>.method` does not move what is already filed. The old backend
still holds the work; only the new one is queried — so in-flight work goes **invisible**,
not merely misplaced. Observed while dogfooding: this repo flipped `plan` to `gitea` while
`plan-backlog-backend` was a live `local` plan, and a fresh-context "Continue plan" reported
*"no plan in progress"*.

The two directions are **not symmetric**:

| Switch          | What strands                            | How it looks                                                   |
| --------------- | --------------------------------------- | -------------------------------------------------------------- |
| `local` → forge | `plan-<slug>.md` / `current.md`; todo files | "no plan in progress"; orphaned files sit on disk            |
| forge → `local` | **open** stage / todo tickets           | work invisible *and* the milestone lingers open forever         |

`backlog.plan` and `backlog.todo` switch independently, so they strand **separately**:
detection is per-section, never per-repo. Todos also differ in kind — a flat queue with no
current pointer, so "stranded" there means *any* unfinished item, not a mid-flight pointer.

### The policy: surface always, migrate only on request

**Detect and surface. Never auto-migrate. Never refuse the switch.** Settled — the reasoning,
so it is not re-litigated:

- **Auto-migrating is exactly the guess §6 forbids.** There, an ambiguous plan costs one
  round-trip to ask; here a wrong guess writes and closes tickets across two backends.
- **Refusing is not implementable at the right moment.** A skill reads `.jarrin.yml` *after*
  the edit it would refuse, and nothing intercepts that edit — the `SessionStart` hook cannot
  even parse `backlog:` (§1). "Blocking the switch" could only mean refusing the user's
  current, unrelated request over an edit already made.
- **Surface-only, with no migration, is too weak.** Migrating by hand means recreating stage
  tickets with the right label IDs, milestone, and closed state — the precise trap-laden work
  §2–§5 exist to encapsulate.

The notice is **non-blocking**: do the user's actual request, then report the strand in one
line. It is a line of report, never a question that gates the request — because detection
runs on every invocation, and a prompt each time would be worse than the bug it fixes. It
repeats until the strand is resolved (migrated, or deleted / closed). That is deliberate:
stranded work is real work.

### Detection

Runs at **§1 config resolution** in both skills — that is where the method becomes known —
and checks only the backend the config does *not* name (in practice the one alternate:
`local` ↔ the forge). Silent unless it finds something. The whole check is one stat or one
label query; never sweep.

| Section | Configured | Check                                              | Stranded when                                          |
| ------- | ---------- | -------------------------------------------------- | ------------------------------------------------------ |
| `plan`  | forge      | stat `<dir>/current.md`                            | it exists **and** its `**Status:**` is not `plan complete` |
| `plan`  | `local`    | the §6 candidate query                             | an open `plan-*` milestone has ≥ 1 open `stage` ticket |
| `todo`  | forge      | list `<dir>`                                       | any `<N>-*.md` file is present                          |
| `todo`  | `local`    | `list_issues(labels: ["todo","claude"], state: "open")` | non-empty                                          |

**"Stranded" means unfinished — not merely present.** The false positives are the whole
difficulty, and each is ruled out by an existing rule rather than a new one:

- A **finished-but-undeleted local plan is not stranded.** §7 keeps `plan-<slug>.md` on disk
  until the user confirms deletion, so existence proves nothing; `current.md`'s `**Status:**`
  is the pointer of record. This is the same shape as the milestone rule below — unfinished is
  decided by the pointer, never by existence.
- A **plan milestone kept open only by caveat tickets is not stranded.** `open_issues > 0` is
  not a valid signal — caveat / cleanup / gotcha tickets count toward it (§6). Reuse the §6
  candidate rule verbatim (an open `plan-*` milestone **with ≥ 1 open `stage` ticket**); do not
  invent a second rule that can drift from it.
- **Local todos over-report, knowingly.** A todo file carries no status field, and §7 only
  *offers* to delete a finished one — so a declined deletion looks identical to open work.
  Tolerable precisely *because* the policy only ever surfaces: a false positive costs one line
  of report, never an action. The weaker definition is affordable only under this policy; an
  auto-migrate would need a status field first.

Two resolution details Stage 2 would otherwise have to invent:

- **`dir` is read under any method for detection.** §1 calls `dir` local-only and forge methods
  ignore it *for writing* — but the local-side check must still honour a custom `dir`, falling
  back to the section default (`.claude/plans` / `.claude/todo`). Otherwise a custom dir is
  never checked.
- **Detection is best-effort and never fails the request.** The forge-side check needs a `repo`
  (§1) and a live MCP; if neither section nor `backlog.repo` names one, or the MCP is absent,
  **skip the check silently** and carry on. This is not the forbidden silent fallback: falling
  back does the user's work in the wrong backend and hides a failure, whereas skipping an
  advisory check leaves the actual request untouched.

### Migration (only when explicitly asked)

Triggered only by an explicit request ("migrate plan-<slug>", "migrate the todos") — **never**
implied by a Continue verb, and never by the notice itself. The **destination is always the
currently configured method**: that is the backend the user chose.

**`local` → forge** — create per §4 / §5, and reuse §5's idempotency rule verbatim (resolve the
milestone, `list_issues(state: "all")`, skip titles that already exist), so a half-migrated plan
is safe to re-run.

- Milestone description ← `## Overview`. One `Stage <n> — <title>` ticket per stage, in stage
  order, labelled and assigned per §5.
- **Finished stages must land closed**, or migration re-runs completed work. A stage is
  finished iff it precedes `current.md`'s current stage, or *is* it with status
  `stage complete`. `current.md` is the pointer of record; the ticked checkboxes in
  `plan-<slug>.md` are a secondary signal only. Create the ticket, then close it per §7.
- The `current.md` **notes section is the handoff** (§6 reads it from closed stage tickets'
  comments) — attach it as the outcome comment on the **last closed** stage ticket, or, if no
  stage is closed yet, on the lowest open one. It must survive the crossing.
- Do **not** mint caveat / cleanup / gotcha tickets out of those notes. The blob has no
  per-note structure to recover, and inventing one is a guess.
- Then **offer to delete** the local files — never silently; §7's confirm rule governs.

**forge → `local`** — write `plan-<slug>.md` + `current.md` from the milestone and its tickets.
This direction is **lossy**; say what is dropped rather than dropping it quietly.

- **Preserved:** overview (milestone description → `## Overview`), each stage's title, step
  checklist and **Done when** (ticket bodies), the closed stages ticked, and the closed tickets'
  outcome comments folded into `current.md`'s notes section — that is the handoff, so it must
  survive. Open caveat / cleanup / gotcha tickets fold into the same notes section, which is
  their local representation.
- **Dropped:** issue numbers, comment threads, authorship, timestamps. State this in the report.
- **The old forge side can only be closed, never removed** — there is no issue-delete method
  (§2). Close each migrated ticket with an outcome comment naming where the work went (e.g.
  `migrated to .claude/plans/plan-<slug>.md`). Folding the caveats in too is what lets the
  milestone reach `open_issues == 0`; only then may it be closed, per §7.

**Todos** carry no stage order, so both directions are flat: `local` → forge files each as a
todo issue per §5 then offers to delete the files; forge → `local` writes one numbered file per
open todo, then closes each issue with a pointer comment. The general `todo` milestone is
permanent either way — never auto-close it (§7).
