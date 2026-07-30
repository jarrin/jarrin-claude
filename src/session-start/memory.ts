import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Delivering a repo's rules as project MEMORY rather than as hook output.
 *
 * The SessionStart hook may only inject so much: past roughly 25 KB Claude Code
 * spills `additionalContext` to a transcript file and shows the model a ~2 KB
 * preview. A repo with four rule files and a page of project instructions
 * crosses that easily, and the truncation is silent — the session simply starts
 * without most of what it selected.
 *
 * So the hook writes the document here instead, and a one-line `@` import in the
 * repo's `CLAUDE.md` pulls it in as project memory, which has no such cap. The
 * hook then injects only a pointer.
 *
 * The file is generated and gitignored: it is a rendering of `.jarrin.yml` plus
 * the rule library, and committing it would be committing a cache that goes
 * stale the moment a rule is edited.
 */

/** Repo-relative path of the generated document. POSIX separators — it is also written into `CLAUDE.md` as an import, which is not a filesystem path. */
export const MEMORY_REL = ".claude/.jarrin-rules.md";

/** The line a repo's `CLAUDE.md` needs for Claude Code to load the document natively. */
export const MEMORY_IMPORT = `@${MEMORY_REL}`;

/**
 * Write the rules document, returning whether the file changed.
 *
 * Unchanged content is left alone rather than rewritten: the hook runs on every
 * session start, and touching the mtime each time would make the file look edited
 * to every watcher and diff tool pointed at the repo.
 */
export function writeRulesDocument(cwd: string, content: string): boolean {
  const path = join(cwd, MEMORY_REL);
  let existing: string | null = null;
  try {
    existing = readFileSync(path, "utf8");
  } catch {
    // Absent or unreadable — treat as "needs writing".
  }
  if (existing === content) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  return true;
}

/** What {@link wireProjectMemory} changed, for the caller to report. */
export interface WireResult {
  readonly importAdded: boolean;
  readonly gitignoreAdded: boolean;
}

/**
 * Make a repo load the document: an `@` import in `CLAUDE.md` and a `.gitignore`
 * entry for the generated file.
 *
 * `CLAUDE.md` is created when absent and otherwise only appended to — a repo's
 * own project memory is hand-written and must survive being wired. Both edits are
 * idempotent, so `init` can be re-run at will.
 */
export function wireProjectMemory(cwd: string): WireResult {
  return {
    importAdded: ensureLine(
      join(cwd, "CLAUDE.md"),
      MEMORY_IMPORT,
      `# Project memory\n\nRules selected in \`.claude/.jarrin.yml\`, rendered by \`claudjar\`:\n\n${MEMORY_IMPORT}\n`,
    ),
    gitignoreAdded: ensureLine(
      join(cwd, ".gitignore"),
      MEMORY_REL,
      `# Generated from .claude/.jarrin.yml on every session start\n${MEMORY_REL}\n`,
    ),
  };
}

/**
 * Append `line` to `path` unless it is already there, creating the file with
 * `whenNew` if it does not exist. Returns whether anything was written.
 */
function ensureLine(path: string, line: string, whenNew: string): boolean {
  let existing: string;
  try {
    existing = readFileSync(path, "utf8");
  } catch {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, whenNew, "utf8");
    return true;
  }
  if (existing.split(/\r?\n/).some((l) => l.trim() === line)) return false;
  const separator = existing.endsWith("\n") ? "" : "\n";
  writeFileSync(path, `${existing}${separator}\n${line}\n`, "utf8");
  return true;
}

/**
 * Whether `CLAUDE.md` in this repo imports the document.
 *
 * Checked so the hook can say so on stderr: without the import the rules reach
 * the session only via the pointer's "read it before starting work", which costs
 * a tool call and depends on the model obeying. `claudjar init` writes the line.
 */
export function hasMemoryImport(cwd: string): boolean {
  try {
    const text = readFileSync(join(cwd, "CLAUDE.md"), "utf8");
    return text.includes(MEMORY_IMPORT);
  } catch {
    return false;
  }
}
