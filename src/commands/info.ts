import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { buildCommand } from "@stricli/core";

import { discoverSkills } from "../config/catalog.js";
import { loadEffectiveConfig } from "../config/load.js";
import type { LocalContext } from "../context.js";
import { toplevel } from "../git.js";
import {
  backlogMethods,
  formatReport,
  type InfoReport,
  type RuleLine,
} from "../info/report.js";
import { resolveRules } from "../session-start/resolve.js";

/**
 * Inspect the current repo: the config files present, the resolved rules (with
 * on-disk presence), the command table, backlog + worktree config, and the
 * skills available. Reads the merged view of `.jarrin.yml` + `.jarrin.local.yml`.
 */
function runInfo(this: LocalContext): void {
  const proc = this.process;
  const cwd = proc.cwd();
  const repoRoot = toplevel(cwd) ?? cwd;
  const claudeDir = join(repoRoot, ".claude");
  const groupRoot = proc.env.JARRIN_GROUP_ROOT ?? dirname(resolve(repoRoot));

  const loaded = loadEffectiveConfig(claudeDir);
  const cfg = loaded.merged;

  const rules: RuleLine[] = resolveRules(
    cfg,
    repoRoot,
    groupRoot,
    this.rulesDir,
  ).map(({ label, path }) => ({ label, path, exists: isFile(path) }));

  const baseText = readIfPresent(join(claudeDir, ".jarrin.yml"));

  const report: InfoReport = {
    repoRoot,
    hasBase: loaded.hasBase,
    hasLocal: loaded.hasLocal,
    rules,
    commands: cfg.commands,
    backup: cfg.backup,
    hasJarrinMd: isFile(join(claudeDir, ".jarrin-claude.md")),
    project: cfg.project,
    hooks: cfg.hooks,
    worktree: cfg.worktree,
    caddy: cfg.caddy,
    // `backlog:` is skill-owned and not overridable — read it from the committed
    // base only.
    backlog: backlogMethods(baseText ?? ""),
    skills: discoverSkills(this.skillsDir),
  };

  proc.stdout.write(formatReport(report));
}

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export const infoCommand = buildCommand({
  func: runInfo,
  parameters: { flags: {} },
  docs: {
    brief:
      "Show this repo's resolved rules, commands, backlog, worktree, and skills",
  },
});
