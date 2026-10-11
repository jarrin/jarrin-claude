import { homedir } from "node:os";
import { join } from "node:path";

import type { CommandContext } from "@stricli/core";

import { claudeConfigPath } from "./session/trust.js";

/**
 * Application context injected into every command. stricli binds this as `this`
 * inside a command's `func`, so all process/stdout/env access flows through it —
 * which keeps commands unit-testable with a fake process.
 */
export interface LocalContext extends CommandContext {
  readonly process: NodeJS.Process;
  /**
   * Global rule library — `~/.claude/rule-library` unless `JARRIN_RULES_DIR`
   * is set.
   *
   * Deliberately NOT `~/.claude/rules`: Claude Code auto-loads every `.md` in
   * that directory as always-on global instructions, which would put the whole
   * library in every session and make a repo's `rules:` selection meaningless.
   * The library is a catalog to pick FROM, so it has to sit outside the paths
   * Claude reads on its own; the SessionStart hook injects only what a repo
   * selected.
   */
  readonly rulesDir: string;
  /** Skills library — `~/.claude/skills` unless `JARRIN_SKILLS_DIR` is set. */
  readonly skillsDir: string;
  /**
   * Machine-wide caddy state (registry + generated Caddyfile) —
   * `~/.claudjar/caddy` unless `JARRIN_CADDY_DIR` is set.
   *
   * Deliberately outside `~/.claude`: this is claudjar's own runtime state, not
   * Claude config, and nothing here is symlinked from the repo.
   */
  readonly caddyDir: string;
  /**
   * Claude Code's own config, which holds workspace trust —
   * `$CLAUDE_CONFIG_DIR/.claude.json` or `~/.claude.json`.
   */
  readonly claudeConfig: string;
}

export function buildContext(proc: NodeJS.Process): LocalContext {
  const rulesDir =
    proc.env.JARRIN_RULES_DIR ?? join(homedir(), ".claude", "rule-library");
  const skillsDir =
    proc.env.JARRIN_SKILLS_DIR ?? join(homedir(), ".claude", "skills");
  const caddyDir =
    proc.env.JARRIN_CADDY_DIR ?? join(homedir(), ".claudjar", "caddy");
  return {
    process: proc,
    rulesDir,
    skillsDir,
    caddyDir,
    claudeConfig: claudeConfigPath(proc.env),
  };
}
