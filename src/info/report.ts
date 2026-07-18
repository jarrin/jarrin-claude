import { parse } from "yaml";

import type { CommandRow, WorktreeConfig } from "../config/schema.js";

/** A resolved rule with its on-disk presence, for the info listing. */
export interface RuleLine {
  readonly label: string;
  readonly path: string;
  readonly exists: boolean;
}

/** Resolved `backlog:` methods, for the info listing (skill-owned block). */
export interface BacklogMethods {
  readonly plan: string;
  readonly todo: string;
  readonly repo: string;
}

export interface InfoReport {
  readonly repoRoot: string;
  readonly hasBase: boolean;
  readonly hasLocal: boolean;
  readonly rules: readonly RuleLine[];
  readonly commands: readonly CommandRow[];
  readonly backup: string;
  readonly hasJarrinMd: boolean;
  readonly worktree: WorktreeConfig;
  readonly backlog: BacklogMethods;
  readonly skills: readonly string[];
}

/**
 * Read the skill-owned `backlog:` block just far enough to report the configured
 * methods. The CLI never writes this block; `info` only surfaces it. Missing keys
 * default to `local` (see the backlog reference §1).
 */
export function backlogMethods(text: string): BacklogMethods {
  const fallback: BacklogMethods = { plan: "local", todo: "local", repo: "" };
  let doc: unknown;
  try {
    doc = parse(text);
  } catch {
    return fallback;
  }
  if (doc === null || typeof doc !== "object") return fallback;
  const backlog = (doc as Record<string, unknown>).backlog;
  if (backlog === null || typeof backlog !== "object") return fallback;
  const rec = backlog as Record<string, unknown>;
  const repo = str(rec.repo);
  return {
    plan: sectionMethod(rec.plan),
    todo: sectionMethod(rec.todo),
    repo,
  };
}

function sectionMethod(section: unknown): string {
  if (section === null || typeof section !== "object") return "local";
  const method = str((section as Record<string, unknown>).method);
  return method || "local";
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const CHECK = "✓"; // ✓
const CROSS = "✗"; // ✗

/** Render an {@link InfoReport} as the human-readable `claudjar info` output. */
export function formatReport(r: InfoReport): string {
  const lines: string[] = [];
  lines.push(`claudjar info — ${r.repoRoot}`);
  lines.push("");

  lines.push("Config files (.claude/):");
  lines.push(`  ${mark(r.hasBase)} .jarrin.yml         (committed base)`);
  lines.push(
    `  ${mark(r.hasLocal)} .jarrin.local.yml   (local override, gitignored)`,
  );
  lines.push(
    `  ${mark(r.hasJarrinMd)} .jarrin-claude.md   (project instructions)`,
  );
  lines.push("");

  lines.push("Rules (load order — ✓ found, ✗ missing):");
  if (r.rules.length === 0) {
    lines.push("  (none selected)");
  } else {
    for (const rule of r.rules) {
      lines.push(`  ${mark(rule.exists)} ${rule.label}`);
    }
  }
  lines.push("");

  lines.push("Commands:");
  if (r.commands.length === 0) {
    lines.push("  (none)");
  } else {
    for (const c of r.commands) {
      lines.push(`  ${c.cmd}${c.desc ? ` — ${c.desc}` : ""}`);
    }
  }
  lines.push("");

  lines.push("Backlog:");
  lines.push(
    `  plan: ${r.backlog.plan}   todo: ${r.backlog.todo}${r.backlog.repo ? `   repo: ${r.backlog.repo}` : ""}`,
  );
  lines.push("");

  lines.push("Worktree:");
  lines.push(`  name:  ${r.worktree.name || "(main worktree)"}`);
  lines.push(
    `  dir:   ${r.worktree.dir || "(default: <repo>-worktrees sibling)"}`,
  );
  lines.push(
    `  copy:  ${r.worktree.copy.length ? r.worktree.copy.join(", ") : "(none beyond .jarrin.local.yml)"}`,
  );
  lines.push(
    `  setup: ${r.worktree.setup.length ? r.worktree.setup.join(" && ") : "(none)"}`,
  );
  lines.push("");

  lines.push(`Backup: ${r.backup || "(none)"}`);
  lines.push("");

  lines.push("Skills available:");
  lines.push(r.skills.length ? `  ${r.skills.join(", ")}` : "  (none found)");

  return lines.join("\n") + "\n";
}

function mark(present: boolean): string {
  return present ? CHECK : CROSS;
}
