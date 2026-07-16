---
name: todo
description: >-
  Create a todo / issue / ticket / task for the current repo, routing to the backend
  configured per-repo in .claude/.jarrin.yml under a `todo:` block — a Gitea, GitHub, or
  GitLab MCP, or a numbered markdown file under .claude/todo/. Use this whenever the user
  wants to file, create, add, log, or track a todo, issue, ticket, task, or backlog item
  for the repo — e.g. "add a todo", "create an issue", "file a ticket", "track this as a
  task", "note this for later", or "/todo …" — even when they don't name a backend.
---

# todo — file a repo issue through the configured backend

Create one or more todos for the current repo. The backend is chosen per-repo in
`.claude/.jarrin.yml`; this skill reads that config itself (the jarrin `SessionStart`
hook ignores the `todo:` key — it is skill-owned).

## 1. Read the config

Read `<repo-root>/.claude/.jarrin.yml` and find the top-level `todo:` mapping:

```yaml
todo:
  backend: gitea          # gitea | github | gitlab | file   (default: file)
  repo: owner/name        # target repo for the MCP backends — required for gitea/github/gitlab
  dir: .claude/todo       # file backend output directory     (default: .claude/todo)
  # any extra keys (labels, assignee, project, milestone) are passed through when the
  # chosen backend's tool supports them; ignore ones it doesn't.
```

- If there is **no `todo:` block**, default to `backend: file`, `dir: .claude/todo`.
- If `backend` is one of `gitea` / `github` / `gitlab` but `repo` is missing, stop and ask
  the user which `owner/name` to file against — don't guess.

## 2. Derive title + body

From the user's request, derive a concise imperative **title** (e.g. "Refactor the
download matcher registry") and an optional **body** with the detail, acceptance notes,
and any file references. If the user asked for several todos, handle each one.

## 3. Route to the backend

### `gitea` / `github` / `gitlab` — via MCP

The issue-creation tool is provided by that backend's MCP server. Load it on demand:

- Find it with `ToolSearch`, e.g. `select:` by exact name if known, otherwise a keyword
  query like `gitea create issue`, `github create issue`, `gitlab create issue`.
- Call it with the target `repo` (`owner/name`), the title, and the body. Pass through any
  supported extras from the config (`labels`, `assignee`, …).
- Report the created issue's number and URL.

If **no matching MCP tool is available** for the configured backend (the server isn't
connected this session), do not silently invent one and do not quietly write files the
user didn't ask for. Tell the user the `<backend>` MCP isn't connected, and offer to use
the `file` fallback (`.claude/todo/`) instead.

### `file` — numbered markdown under `.claude/todo/`

Run the bundled helper; it computes the next number, kebab-cases the title, and writes the
file atomically:

```bash
scripts/new-todo-file --dir "<dir>" --title "<title>" <<'BODY'
<optional multi-line body>
BODY
```

It prints the created path (e.g. `.claude/todo/3-refactor-download-matcher.md`). Numbering
continues from the highest existing `N-` prefix in the directory. Report the path back.

## 4. Confirm

State plainly what was created — the issue URL (MCP backends) or the file path (file
backend) — one line per todo. If nothing could be created (e.g. missing `repo`, or an
unavailable MCP with the fallback declined), say so and why.
