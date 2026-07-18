import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { buildCommand } from "@stricli/core";

import { discoverRuleSlugs } from "../config/catalog.js";
import { parseConfig } from "../config/read.js";
import type { CommandRow, ImportRule, JarrinConfig } from "../config/schema.js";
import { emptyConfig } from "../config/schema.js";
import { serializeConfig } from "../config/write.js";
import type { LocalContext } from "../context.js";
import { AbortError, loadPrompts, resolveInteractive } from "../interaction.js";

interface InitFlags {
  readonly rule: string[];
  readonly local: string[];
  readonly import: string[];
  readonly command: string[];
  readonly backup: string;
  readonly jarrinMd: boolean;
  readonly force: boolean;
  readonly yes: boolean;
  readonly interaction: boolean;
}

/**
 * Set up (or update) `.claude/.jarrin.yml` for the current repo. Mode is
 * auto-detected: absent file → create from a commented template; present file →
 * update it, preserving comments and the skill-owned `backlog:` block.
 */
async function runInit(this: LocalContext, flags: InitFlags): Promise<void> {
  const proc = this.process;
  const cwd = proc.cwd();
  const claudeDir = join(cwd, ".claude");
  const jarrinYml = join(claudeDir, ".jarrin.yml");
  const jarrinMd = join(claudeDir, ".jarrin-claude.md");

  const exists = isFile(jarrinYml);
  const existingText = exists ? readFileSync(jarrinYml, "utf8") : undefined;
  const base = existingText ? parseConfig(existingText) : emptyConfig();
  const interactive = resolveInteractive(this, flags.interaction);

  let cfg: JarrinConfig;
  let scaffoldMd: boolean;
  try {
    if (interactive) {
      const result = await promptForConfig(this, base, exists, jarrinMd);
      cfg = result.cfg;
      scaffoldMd = result.scaffoldMd;
    } else {
      cfg = mergeFlags(base, flags);
      scaffoldMd = flags.jarrinMd;
    }
  } catch (e) {
    if (e instanceof AbortError) {
      proc.stderr.write(`${e.message}\n`);
      proc.exitCode = 1;
      return;
    }
    throw e;
  }

  const output = serializeConfig(cfg, existingText);

  // Confirm before writing when interactive and not pre-approved.
  if (interactive && !flags.yes && !flags.force) {
    const prompts = await loadPrompts();
    prompts.note(output, exists ? "Updated .jarrin.yml" : "New .jarrin.yml");
    const ok = await prompts.confirm({
      message: exists ? "Write these changes?" : "Create this file?",
    });
    if (prompts.isCancel(ok) || !ok) {
      prompts.cancel("No changes written.");
      proc.exitCode = 1;
      return;
    }
  }

  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(jarrinYml, output, "utf8");

  if (scaffoldMd && !isFile(jarrinMd)) {
    writeFileSync(jarrinMd, jarrinMdTemplate(cwd), "utf8");
  }

  const verb = exists ? "Updated" : "Created";
  const rel = jarrinYml.startsWith(cwd)
    ? jarrinYml.slice(cwd.length + 1)
    : jarrinYml;
  proc.stdout.write(`${verb} ${rel}\n`);
  if (scaffoldMd && isFile(jarrinMd)) {
    proc.stdout.write(`Scaffolded ${basename(jarrinMd)}\n`);
  }
  proc.stdout.write("Restart your Claude Code session to load the rules.\n");
}

/** Merge CLI flags additively onto the existing config (union, deduped). */
function mergeFlags(base: JarrinConfig, flags: InitFlags): JarrinConfig {
  const cfg = emptyConfig();
  cfg.rules.push(...unique([...base.rules, ...flags.rule]));
  cfg.local.push(...unique([...base.local, ...flags.local]));

  const importKey = (i: ImportRule): string => `${i.owner}/${i.rule}`;
  const imports = new Map<string, ImportRule>();
  for (const i of base.imports) imports.set(importKey(i), i);
  for (const i of parseImports(flags.import)) imports.set(importKey(i), i);
  cfg.imports.push(...imports.values());

  const commands = new Map<string, CommandRow>();
  for (const c of base.commands) commands.set(c.cmd, c);
  for (const c of parseCommands(flags.command)) commands.set(c.cmd, c);
  cfg.commands.push(...commands.values());

  cfg.backup = flags.backup.trim() || base.backup;
  return cfg;
}

/** Interactive clack flow. Returns the assembled config + md-scaffold choice. */
async function promptForConfig(
  ctx: LocalContext,
  base: JarrinConfig,
  exists: boolean,
  jarrinMd: string,
): Promise<{ cfg: JarrinConfig; scaffoldMd: boolean }> {
  const p = await loadPrompts();
  const cancel = (v: unknown): void => {
    if (p.isCancel(v)) throw new AbortError();
  };

  p.intro(exists ? "claudjar init — update" : "claudjar init — setup");

  const catalog = discoverRuleSlugs(ctx.rulesDir);
  const options = unique([...catalog, ...base.rules]).map((slug) => ({
    value: slug,
    label: slug,
  }));
  const rules = options.length
    ? await p.multiselect<string>({
        message: "Global rules to load:",
        options,
        initialValues: base.rules,
        required: false,
      })
    : base.rules;
  cancel(rules);

  const local = await p.text({
    message: "Local rule files (space-separated paths, optional):",
    placeholder: ".claude/rules/my-rule.md",
    initialValue: base.local.join(" "),
    defaultValue: "",
  });
  cancel(local);

  const imports = await p.text({
    message: "Cross-repo imports (space-separated owner:rule, optional):",
    placeholder: "server:prdl-data-types",
    initialValue: base.imports.map((i) => `${i.owner}:${i.rule}`).join(" "),
    defaultValue: "",
  });
  cancel(imports);

  const commands = await promptCommands(ctx, base.commands);

  const backup = await p.text({
    message: "Backup command (run before a new session, optional):",
    placeholder: "git bundle create ../backup.bundle --all",
    initialValue: base.backup,
    defaultValue: "",
  });
  cancel(backup);

  let scaffoldMd = false;
  if (!isFile(jarrinMd)) {
    const wantMd = await p.confirm({
      message: "Scaffold .claude/.jarrin-claude.md (project instructions)?",
      initialValue: false,
    });
    cancel(wantMd);
    scaffoldMd = wantMd === true;
  }

  const cfg = emptyConfig();
  cfg.rules.push(...unique(rules as string[]));
  cfg.local.push(...unique(splitWords(local as string)));
  cfg.imports.push(...parseImports(splitWords(imports as string)));
  cfg.commands.push(...commands);
  cfg.backup = (backup as string).trim();

  return { cfg, scaffoldMd };
}

/** Loop that lets the user add command rows one at a time. */
async function promptCommands(
  ctx: LocalContext,
  base: readonly CommandRow[],
): Promise<CommandRow[]> {
  const p = await loadPrompts();
  const cancel = (v: unknown): void => {
    if (p.isCancel(v)) throw new AbortError();
  };
  const rows: CommandRow[] = [...base];

  const start = await p.confirm({
    message: base.length
      ? `Keep ${String(base.length)} existing command(s) and add more?`
      : "Add dev-command quick-reference rows?",
    initialValue: false,
  });
  cancel(start);
  if (start !== true) return rows;

  for (;;) {
    const cmd = await p.text({
      message: "Command (blank to stop):",
      placeholder: "pnpm check",
      defaultValue: "",
    });
    cancel(cmd);
    const cmdStr = (cmd as string).trim();
    if (!cmdStr) break;
    const desc = await p.text({
      message: `What does \`${cmdStr}\` do?`,
      defaultValue: "",
    });
    cancel(desc);
    rows.push({ cmd: cmdStr, desc: (desc as string).trim() });
  }
  return rows;
}

function parseImports(items: readonly string[]): ImportRule[] {
  const out: ImportRule[] = [];
  for (const item of items) {
    const [owner, rule] = item.split(":", 2).map((s) => s.trim());
    if (owner && rule) out.push({ owner, rule });
  }
  return out;
}

function parseCommands(items: readonly string[]): CommandRow[] {
  const out: CommandRow[] = [];
  for (const item of items) {
    const idx = item.indexOf("=");
    if (idx === -1) {
      out.push({ cmd: item.trim(), desc: "" });
    } else {
      out.push({
        cmd: item.slice(0, idx).trim(),
        desc: item.slice(idx + 1).trim(),
      });
    }
  }
  return out.filter((c) => c.cmd);
}

function splitWords(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function unique(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

function jarrinMdTemplate(cwd: string): string {
  const name = basename(cwd);
  return (
    `# ${name} — project instructions\n\n` +
    "<!-- Always-apply instructions for this repo. Appended verbatim to the\n" +
    "     session context after the selected rules. Add hard rules and a\n" +
    '     "Start here" orientation here as prose. -->\n'
  );
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export const initCommand = buildCommand({
  func: runInit,
  parameters: {
    flags: {
      rule: {
        kind: "parsed",
        parse: String,
        variadic: true,
        brief: "Global rule slug to select (repeatable)",
        default: [],
      },
      local: {
        kind: "parsed",
        parse: String,
        variadic: true,
        brief: "In-repo rule file path (repeatable)",
        default: [],
      },
      import: {
        kind: "parsed",
        parse: String,
        variadic: true,
        brief: "Cross-repo import as owner:rule (repeatable)",
        default: [],
      },
      command: {
        kind: "parsed",
        parse: String,
        variadic: true,
        brief: "Quick-reference row as cmd=desc (repeatable)",
        default: [],
      },
      backup: {
        kind: "parsed",
        parse: String,
        brief: "Backup command run before a new session",
        default: "",
      },
      jarrinMd: {
        kind: "boolean",
        brief: "Scaffold .claude/.jarrin-claude.md if missing",
        default: false,
      },
      force: {
        kind: "boolean",
        brief: "Write without the confirmation prompt",
        default: false,
      },
      yes: {
        kind: "boolean",
        brief: "Assume yes for confirmations",
        default: false,
      },
      interaction: {
        kind: "boolean",
        brief: "Prompt interactively (use --no-interaction to disable)",
        default: true,
      },
    },
  },
  docs: {
    brief: "Set up or update .claude/.jarrin.yml for this repo",
  },
});
