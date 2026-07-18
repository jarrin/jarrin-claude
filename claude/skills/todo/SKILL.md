---
name: todo
description: >-
  Create a todo / issue / ticket / task for the current repo, routing to the backend
  configured per-repo in .claude/.jarrin.yml under the `backlog.todo` section — a Gitea,
  GitHub, or GitLab issue, or a numbered markdown file under .claude/todo/. Use this
  whenever the user wants to file, create, add, log, or track a todo, issue, ticket, task,
  or backlog item for the repo — e.g. "add a todo", "create an issue", "file a ticket",
  "track this as a task", "note this for later", or "/todo …" — even when they don't name
  a backend. Also owns the "Continue todos" verb — picking up the oldest open todo and
  working it — and "migrate the todos": moving them to the currently configured backend.
---

# todo — file a repo todo through the configured backlog backend

Create one or more todos for the current repo. The backend is chosen per-repo in
`.claude/.jarrin.yml` under `backlog.todo`; this skill parses that block itself — the
jarrin `SessionStart` hook cannot, since nested keys are outside its YAML subset.

`~/.claude/references/backlog.md` is the single source of truth for config resolution,
labels, milestones, ticket bodies, and the silent API traps. Read it before the first
forge call; this skill points at it rather than restating it.

## 1. Resolve the config

Read `<repo-root>/.claude/.jarrin.yml` and resolve the `backlog.todo` section per **§1 of
the reference** — defaults, `repo` inheritance, and the fail-loudly rule live there.

```yaml
backlog:
  repo: owner/name       # home repo; shared default for both sections
  todo:
    method: gitea        # local (alias: repo) | gitea | github | gitlab   (default: local)
    assignee: claude     # forge methods only
    repo: owner/name     # optional override of backlog.repo
    dir: .claude/todo    # local method only (default: .claude/todo)
```

No `backlog:` block, or no `todo:` section → `method: local`, `dir: .claude/todo`. A forge
method with no `repo` anywhere → stop and ask which `owner/name` to file against.

### Stranded-work check

Resolving the method is also where **reference §8** runs: switching a method does not move
the work already filed, it hides it. Check the backend the config does *not* name — the
**todo side only**, never `backlog.plan`. Todos are a flat queue with no current pointer, so
stranded means *any* unfinished item. One list; never a sweep.

- **Configured forge** → list `<dir>`. Resolve `dir` even under a forge method (default
  `.claude/todo`); it is local-only for *writing*, not for this check. Stranded when any
  `<N>-*.md` file is present.
- **Configured `local`** → `list_issues(labels: ["todo", "claude"], state: "open")` against
  the resolved repo. Stranded when non-empty.

Local todos **knowingly over-report**: a todo file carries no status field and §5 only
*offers* to delete a finished one, so a declined deletion is indistinguishable from open
work. Accepted, because the policy only ever surfaces — a false positive costs one line of
report, never an action.

**Silent when there is nothing.** When there is: do the user's actual request first, then
report the strand in **one line** — how many todos, and which backend still holds them. It is
a line of report, never a question, and never gates the request. Migrate only when the user
explicitly asks, per **reference §8**; "Continue todos" never implies it.

Best-effort: no resolvable `repo`, or no MCP → skip the check silently and carry on. That is
not the forbidden silent fallback — skipping an advisory check leaves the request untouched.

### Worktree scoping

Also read `worktree.name` from `<repo>/.claude/.jarrin.local.yml` (best-effort; missing → the
main worktree). When set, forge todos are scoped to that worktree per **reference §9**: creation
adds the `worktree/<name>` label, and "Continue todos" / the stranded check filter by it — a
worktree sees only its own todos, main drops worktree-scoped ones. `local` todos are already
per-directory, so scoping is a `gitea` concern only.

## 2. Derive title + body

Derive a concise imperative **title** (e.g. "Refactor the download matcher registry"). The
body follows the reference's §5 format:

```markdown
**Request:** <the user's ask, verbatim — not a paraphrase>
**Scope:** <repo(s) the work touches, e.g. `owner/name`; or "this repo">

<detail: context, file references, acceptance notes>
```

If the user asked for several todos, handle each one.

## 3. Route to the method

### `local` — numbered markdown under `.claude/todo/`

Run the bundled helper; it computes the next number, kebab-cases the title, and writes the
file atomically:

```bash
scripts/new-todo-file --dir "<dir>" --title "<title>" <<'BODY'
<optional multi-line body>
BODY
```

It prints the created path (e.g. `.claude/todo/3-refactor-download-matcher.md`). Numbering
continues from the highest existing `N-` prefix in the directory.

### `gitea` — an issue under the general `todo` milestone

Load the tools in one call:

```
ToolSearch select:mcp__gitea__label_read,mcp__gitea__label_write,mcp__gitea__milestone_read,mcp__gitea__milestone_write,mcp__gitea__issue_write
```

Then, against the resolved `owner/name`:

1. **Labels** (§3) — `label_read list_repo_labels`, create only the names that are missing,
   and resolve `todo` + `claude` to numeric IDs. Never blind-create: `create_repo_label`
   silently duplicates an existing name.
2. **Milestone** (§4) — resolve the general `todo` milestone: `milestone_read list`
   (`state: "open"`, `name: "todo"`) narrows by **substring**, so match `title == "todo"`
   exactly client-side; create it with `milestone_write` if absent. It is permanent —
   never auto-close it, even at `open_issues == 0`.
3. **Issue** (§5) — `issue_write create` with the title, the §2 body, `labels` as the
   resolved **IDs** (never names), the milestone **ID**, and `assignees: [<assignee>]` when
   one is configured. A non-collaborator assignee hard-fails loudly — that is the intended
   signal, not something to work around. In a named worktree, add the `worktree/<name>` label
   ID too (reference §9).

### `github` / `gitlab`

Shape-only: neither MCP is connected today. Say the configured method's MCP is unavailable
and stop. **Never** fall back to files silently — the user asked for a forge, and quietly
writing markdown hides that it failed.

## 4. Confirm

State plainly what was created — the issue number and URL, or the file path — one line per
todo. If nothing could be created (missing `repo`, unavailable MCP, rejected assignee), say
so and why.

## 5. "Continue todos" — work the oldest open todo

Resolve `backlog.todo` (§1), then take the **oldest open** todo:

- `local` — the **lowest-numbered** file in `<dir>`.
- `gitea` — `list_issues(labels: ["todo", "claude"], state: "open")` against the resolved
  repo, then the **lowest issue number**: todos carry no stage numbering, so creation order
  *is* queue order. The response is **newest first**, so sorting is still mandatory
  (reference §6). Read the body with `issue_read get` — `list_issues` does not return it.
  In a named worktree, add `worktree/<name>` to the `labels`; in main, drop rows carrying a
  `worktree/*` label (reference §9).

Nothing open → say so; do not reach into the plan milestones for work. Todos are independent
of plans: a todo is never a plan stage, and "Continue todos" never advances a plan.

Do **one** todo, then report and stop, so the user can decide what is next. Finishing one:
`gitea` → comment the outcome, then close (reference §7); `local` → offer to delete the file,
never silently.

## 6. Migrating todos across backends

Only ever on an **explicit request** — "migrate the todos". The §1 notice never implies it,
and neither does "Continue todos". The **destination is always the currently configured
method**: that is the backend the user chose. Rules: **reference §8 ("Migration")**.

Todos are a flat queue — no stage order to preserve, no current pointer to reconstruct — so
both directions are one item per **open** todo (a closed issue is finished work; a deleted
file is gone by request):

- **`local` → forge** — file each `<N>-*.md` as a todo issue per §5: `todo` + `claude` as
  resolved **IDs**, the general `todo` milestone, assignee when configured. Then **offer to
  delete** the files — never silently.
- **forge → `local`** — write one numbered file per open todo (§3's helper), then close each
  issue with a pointer comment naming the file it became. There is no issue-delete method,
  so closing is the only option.

The general `todo` milestone is permanent in either direction — never auto-close it, even at
`open_issues == 0` (§7). Then report what moved and where the todos now live.
