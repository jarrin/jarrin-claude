import { homedir } from "node:os";
import { join } from "node:path";

import type { CommandContext } from "@stricli/core";

/**
 * Application context injected into every command. stricli binds this as `this`
 * inside a command's `func`, so all process/stdout/env access flows through it —
 * which keeps commands unit-testable with a fake process.
 */
export interface LocalContext extends CommandContext {
  readonly process: NodeJS.Process;
  /** Global rule library — `~/.claude/rules` unless `JARRIN_RULES_DIR` is set. */
  readonly rulesDir: string;
  /** Skills library — `~/.claude/skills` unless `JARRIN_SKILLS_DIR` is set. */
  readonly skillsDir: string;
}

export function buildContext(proc: NodeJS.Process): LocalContext {
  const rulesDir =
    proc.env.JARRIN_RULES_DIR ?? join(homedir(), ".claude", "rules");
  const skillsDir =
    proc.env.JARRIN_SKILLS_DIR ?? join(homedir(), ".claude", "skills");
  return { process: proc, rulesDir, skillsDir };
}
