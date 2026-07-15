---
name: staged-planning
description: Jarrin's required workflow for ANY request to "create a plan" (or "make a plan", "plan out X"). Plans are always split into stages, persisted under the project's .claude/plans/ folder, and executed ONE stage at a time — stop after every stage, report, and wait for the user to say "Continue plan" in fresh context. Read and follow this whenever the user asks for a plan or says "continue plan".
version: 0.1.0
---

# Staged Planning (Jarrin's workflow)

This is Jarrin's leading, machine-wide workflow for planning work. Whenever the user
asks you to **create / make / write a plan** for something, or says **"continue plan"**,
follow this exactly. It applies in every project and repo unless the user overrides it
for a specific request.

## The golden rule

**NEVER continue to the next stage on your own.** After finishing a stage you stop
completely and wait for the user to clear context and explicitly say "Continue plan".
There are no exceptions — not "the next stage is trivial", not "it's clearly implied",
not "to save a round-trip". Stop means stop.

## Where plans live

Everything for the plan lives in a **`.claude/plans/` folder in the current project's
root** (create it if it does not exist — do not use the home `~/.claude/plans/` folder,
that is Claude Code's own plan-mode storage).

- `.claude/plans/plan-xxx.md` — one file per plan. Replace `xxx` with a short
  kebab-case slug of the goal (e.g. `plan-add-oauth-login.md`).
- `.claude/plans/current.md` — the pointer file: which plan is active and which stage
  is current. There is exactly one active plan at a time.

## When the user asks to CREATE a plan

1. Understand the goal (ask clarifying questions first if it is underspecified).
2. Create `.claude/plans/` in the project root if needed.
3. Write `.claude/plans/plan-<slug>.md` with the plan **split into ordered stages**.
   Each stage must be independently completable and end at a natural stopping point.
   Use the structure below.
4. Write (overwrite) `.claude/plans/current.md` pointing at this plan, with the current
   stage set to **Stage 1** and status `not started`.
5. **Do NOT start executing yet unless the user asked you to.** Present the staged plan
   and let the user confirm. (If the user asked you to create *and* begin, you may then
   execute Stage 1 — and only Stage 1.)

### `plan-<slug>.md` structure

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

### `current.md` structure

```markdown
# Current plan
- **Plan:** plan-<slug>.md
- **Current stage:** Stage <n> — <title>
- **Status:** not started | in progress | stage complete | plan complete
- **Last updated:** <YYYY-MM-DD>

## Notes / caveats carried forward
<anything the next fresh-context session needs to know>
```

## Executing a stage

When executing the current stage (either just after creation if asked, or after a
"Continue plan"):

1. Do the work for **that one stage only**.
2. Update the stage's checkboxes in `plan-<slug>.md` as you complete steps.
3. Update `current.md`: mark the finished stage complete, and record any caveats,
   decisions, or blockers in the "Notes / caveats carried forward" section so the next
   fresh-context session has what it needs.
4. **STOP.** Report to the user:
   - What was done in this stage.
   - Any caveats, surprises, or deviations.
   - Whether it can continue, or is blocked (and why, if so).
   - Then tell the user they can clear context and say **"Continue plan"** to proceed.
5. Do not touch the next stage.

## When the user says "Continue plan" (fresh context)

1. Read `.claude/plans/current.md` to find the active plan and current stage.
2. Read the plan file `.claude/plans/plan-<slug>.md`, plus the carried-forward notes.
3. Execute the current stage following "Executing a stage" above (do the one stage,
   update files, stop and report).

## When the plan finishes

After the final stage completes, set `current.md` status to `plan complete`, report the
outcome, and **offer to delete** the plan files (`plan-<slug>.md`) and clear
`current.md`. Only delete after the user confirms.
