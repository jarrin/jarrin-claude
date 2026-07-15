---
name: add-skill
description: This skill should be used when the user wants to "create a skill", "add a skill", "write a new skill", "scaffold a SKILL.md", "make a Claude Code skill", or asks how skills are structured or where they live. Make sure to use this skill whenever the user talks about authoring, adding, or organizing a Claude Code skill, even if they do not say the word "skill" explicitly.
version: 0.2.0
---

# Add a skill

Guide for authoring a Claude Code **skill** — a self-contained package of procedural
knowledge that Claude loads on demand. Use it to scaffold a new skill correctly and to
avoid the common mistakes that stop a skill from triggering.

## When to reach for a skill (vs. a rule or an MCP)

- **Skill** — an on-demand *procedure or body of knowledge* invoked when its `description`
  matches the task. Zero context cost until it triggers. This is the default for "how to
  do X".
- **Rule** (`.claude/rules/*.md`) — always-on or path-scoped *standing instructions*, not a
  procedure. Choose a rule for "always behave like Y", not "how to do Y".
- **MCP server** — only when a *runtime capability* is needed (live data, external actions,
  a service). Never reach for MCP to deliver instructions; a skill is simpler and portable.

## Where skills live

- **Global (all projects):** `~/.claude/skills/<name>/SKILL.md` — auto-discovered in every
  project. In this repo that path is the symlinked `claude/skills/<name>/`, so a global
  skill is version-controlled here.
- **Project-only:** `<project>/.claude/skills/<name>/SKILL.md` — committed with that repo.

Claude scans these directories, always loads each skill's `name` + `description`, and loads
the `SKILL.md` body only when the skill triggers.

## Anatomy

```
<name>/
├── SKILL.md          (required: YAML frontmatter + Markdown body)
├── scripts/          (optional: executable code for deterministic/repeated tasks)
├── references/       (optional: docs loaded into context only when needed)
└── assets/           (optional: files used in output — templates, images)
```

Progressive disclosure keeps sessions cheap: metadata is always in context, the body loads
on trigger, and `references/`/`scripts/` load only when Claude decides it needs them. Keep
`SKILL.md` lean (aim < ~500 lines) and push detail into `references/`.

## Check for an existing skill first

Before authoring anything from scratch, search the open skills ecosystem — someone may
already have written what the user needs. The canonical registry is
[`vercel-labs/skills`](https://github.com/vercel-labs/skills) (browsable at
[skills.sh](https://skills.sh)), a CLI + registry of reusable agent skills.

1. Search it: `npx skills find "<what the user wants>"` (or browse skills.sh).
2. If a good match exists, prefer installing it over reinventing:
   - Global (every project): `npx skills add <source> --global`
   - Project-only (this repo): `npx skills add <source>`
   Prefer symlink installs so upstream updates flow through. In this repo, install global
   skills into `claude/skills/` so they stay version-controlled.
3. Tell the user what you found — the match and how you installed it, or that nothing fit
   and you're authoring a new one. Only continue to scaffolding when there is no suitable
   existing skill.

## Scaffold a new skill

Run the bundled script — it writes a correct skeleton so the frontmatter and layout are
never wrong:

```bash
# project-level skill in the current repo (./.claude/skills/<name>/)
scripts/scaffold my-skill --description "what it does and when to trigger"

# global skill for every project (~/.claude/skills/<name>/)
scripts/scaffold my-skill --global
```

Then edit the generated `SKILL.md`. The scaffold prints the exact path it created.

## Writing rules that make a skill work

1. **Description is the trigger.** Write it in the **third person** and pack it with the
   exact phrases a user would say ("create a hook", "add a PreToolUse hook"). Skills tend to
   *under*-trigger, so make the description slightly pushy: "…use this whenever the user
   mentions X, even if they don't ask for it by name." A vague description means the skill
   never loads — this is the single most important field.
2. **Body in imperative form.** Write verb-first instructions ("Parse the frontmatter",
   not "You should parse…"). Explain the *why* behind each step instead of piling on
   all-caps MUSTs — the model follows reasoning better than rigid commands.
3. **Bundle repeated work as scripts.** If every use would rewrite the same code, put it in
   `scripts/` once and point the body at it. Deterministic and token-cheap.
4. **No duplication.** A fact lives in `SKILL.md` or a reference file, not both.
5. **English only**, per the global preferences — including the skill's own content.

## Validate before finishing

- `SKILL.md` has valid YAML frontmatter with `name` and `description`.
- Description is third person and lists concrete trigger phrases.
- Body is imperative and lean; detail moved to `references/`.
- Any referenced file or script actually exists and (for scripts) is executable.
- Trigger it: pose a couple of realistic prompts and confirm the skill loads.
