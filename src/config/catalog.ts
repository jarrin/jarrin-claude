import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Discover the available global rule slugs by listing `*.md` files in the rules
 * library (default `~/.claude/rules`, overridable via `JARRIN_RULES_DIR`). Used
 * by `init` to offer a checklist rather than making the user recall slugs.
 * Returns an empty list if the directory is missing.
 */
export function discoverRuleSlugs(rulesDir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(rulesDir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -".md".length))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Discover installed skill names by listing subdirectories of the skills library
 * (default `~/.claude/skills`, overridable via `JARRIN_SKILLS_DIR`) that contain
 * a `SKILL.md`. Used by `info`. Returns an empty list if the directory is
 * missing.
 */
export function discoverSkills(skillsDir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => isFile(join(skillsDir, name, "SKILL.md")))
    .sort((a, b) => a.localeCompare(b));
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
