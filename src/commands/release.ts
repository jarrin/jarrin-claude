import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { buildCommand } from "@stricli/core";

import { BASE_FILE, loadEffectiveConfig } from "../config/load.js";
import { stampDistVersion } from "../config/write.js";
import type { LocalContext } from "../context.js";
import { currentBranch, listTags, statusPorcelain, toplevel } from "../git.js";
import { loadPrompts, resolveInteractive } from "../interaction.js";
import { preflight } from "../release/plan.js";
import { syncVersion } from "../release/sync.js";
import type { BumpKind } from "../release/version.js";
import { parseBumpKind } from "../release/version.js";

interface ReleaseFlags {
  readonly bump: BumpKind;
  readonly branch: string;
  readonly build: boolean;
  readonly tag: boolean;
  readonly dryRun: boolean;
  readonly yes: boolean;
  readonly interaction: boolean;
}

/** A file rewritten during the release, kept so a failed build can be undone. */
interface Edit {
  readonly path: string;
  readonly before: string;
}

/**
 * `claudjar release` — cut a version: bump `project.dist.version`, mirror it into
 * every file listed in `project.dist.sync`, build, commit, and tag.
 *
 * The ordering is the point. The version is written **before** the build so the
 * artifact carries the number it will be tagged with, and the commit happens
 * **after** the build so a broken build never produces a release commit. If the
 * build fails, every file this command rewrote is restored, leaving the tree
 * exactly as it was found.
 *
 * Nothing is pushed. The tag and commit are local, and the command prints the
 * push line for you to run — publishing is a separate, deliberate act.
 */
async function runRelease(
  this: LocalContext,
  flags: ReleaseFlags,
): Promise<void> {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);
  const fail = (msg: string): void => {
    proc.stderr.write(`release: ${msg}\n`);
    proc.exitCode = 1;
  };

  const repoRoot = toplevel(proc.cwd());
  if (!repoRoot) return fail("not inside a git repository.");

  const claudeDir = join(repoRoot, ".claude");
  const cfg = loadEffectiveConfig(claudeDir).merged;

  const check = preflight(
    {
      branch: currentBranch(repoRoot),
      releaseBranch: flags.branch,
      dirty: statusPorcelain(repoRoot),
      currentVersion: cfg.project.dist.version,
      existingTags: listTags(repoRoot),
    },
    flags.bump,
  );
  if (!check.ok) return fail(check.error);
  const plan = check.plan;

  out(`claudjar release — ${repoRoot}\n\n`);
  if (plan.firstRelease) {
    out("  first release (project.dist.version was unset, assuming 0.0.0)\n");
  }
  out(`  version:  ${plan.from} -> ${plan.to} (${flags.bump})\n`);
  out(`  tag:      ${plan.tag}\n`);
  out(`  sync:     ${describeSync(cfg.project.dist.sync)}\n`);
  out(`  build:    ${cfg.project.commands.build || "(none configured)"}\n\n`);

  if (flags.dryRun) {
    out("Dry run — nothing written.\n");
    return;
  }

  if (resolveInteractive(this, flags.interaction) && !flags.yes) {
    const p = await loadPrompts();
    const ok = await p.confirm({
      message: `Release ${plan.tag}?`,
      initialValue: false,
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel("No changes written.");
      proc.exitCode = 1;
      return;
    }
  }

  // 1. Write the version everywhere, remembering the previous contents so a
  //    failed build can put the tree back exactly as it was.
  const edits: Edit[] = [];
  const yml = join(claudeDir, BASE_FILE);
  if (!existsSync(yml)) {
    return fail(`no ${BASE_FILE} in ${claudeDir}; run 'claudjar init' first.`);
  }
  const ymlBefore = readFileSync(yml, "utf8");
  edits.push({ path: yml, before: ymlBefore });
  writeFileSync(yml, stampDistVersion(ymlBefore, plan.to), "utf8");
  out(`  wrote project.dist.version: ${plan.to}\n`);

  const syncFailure = syncFiles(repoRoot, cfg.project.dist.sync, plan.to, {
    edits,
    out,
    warn: (msg) => void proc.stderr.write(`  ! ${msg}\n`),
  });
  if (syncFailure) {
    restore(edits);
    return fail(syncFailure);
  }

  // 2. Build with the new version already on disk.
  const buildCmd = cfg.project.commands.build;
  if (buildCmd && flags.build) {
    out(`\nBuilding: ${buildCmd}\n`);
    const res = spawnSync(buildCmd, {
      cwd: repoRoot,
      shell: true,
      stdio: "inherit",
      env: { ...proc.env, PROJECT_VERSION: plan.to, RELEASE_TAG: plan.tag },
    });
    if (res.status !== 0) {
      restore(edits);
      return fail(
        `build failed (exit ${String(res.status ?? "?")}): ${buildCmd}\n` +
          `Version changes were rolled back; the tree is unchanged.`,
      );
    }
  } else if (!buildCmd) {
    out("\nNo project.commands.build configured; skipping the build.\n");
  } else {
    out("\nSkipped the build (--no-build).\n");
  }

  // 3. Commit the whole tree, then tag it. `git add -A` is deliberate: preflight
  //    guaranteed the tree was clean, so everything staged here is either a
  //    version bump or a product of the build that just ran.
  const message = `Release ${plan.tag}`;
  if (!run(repoRoot, ["add", "-A"], proc)) {
    return fail("`git add -A` failed.");
  }
  if (!run(repoRoot, ["commit", "-m", message], proc)) {
    return fail(
      "`git commit` failed — see git's message above. The version changes are " +
        "staged; commit them by hand or `git reset` to discard.",
    );
  }
  out(`\n  committed: ${message}\n`);

  if (flags.tag) {
    if (!run(repoRoot, ["tag", "-a", plan.tag, "-m", message], proc)) {
      return fail(
        `\`git tag ${plan.tag}\` failed; the release commit was made. Tag it ` +
          `by hand once resolved.`,
      );
    }
    out(`  tagged:    ${plan.tag}\n`);
  } else {
    out("  (--no-tag: no tag created)\n");
  }

  out(`\nNot pushed. To publish:\n` + `  git push --follow-tags\n`);
}

interface SyncReporter {
  readonly edits: Edit[];
  readonly out: (msg: string) => void;
  readonly warn: (msg: string) => void;
}

/**
 * Mirror `version` into every configured file. Returns an error string on the
 * first hard failure (a listed file that is missing, unreadable, or of a type no
 * handler understands), leaving the caller to roll back.
 *
 * A file whose version field is simply absent, or already correct, is reported
 * and skipped: those are states a release can legitimately walk past, whereas a
 * path that cannot be honoured at all means the config is lying about what this
 * project releases.
 */
function syncFiles(
  repoRoot: string,
  paths: readonly string[],
  version: string,
  r: SyncReporter,
): string | null {
  for (const rel of paths) {
    const abs = join(repoRoot, rel);
    if (!existsSync(abs)) {
      return `project.dist.sync lists '${rel}', which does not exist.`;
    }
    const before = readFileSync(abs, "utf8");
    const result = syncVersion(abs, before, version);
    if (result.status === "unsupported") {
      return (
        `project.dist.sync lists '${rel}', but no version handler matches that ` +
        `filename (supported: *.json, .env*, *.toml, *.yml/*.yaml).`
      );
    }
    if (result.status === "no-field") {
      r.warn(`${rel}: no version field found — skipped.`);
      continue;
    }
    if (result.status === "unchanged") {
      r.out(`  ${rel}: already ${version}\n`);
      continue;
    }
    r.edits.push({ path: abs, before });
    writeFileSync(abs, result.text, "utf8");
    r.out(`  ${rel}: ${version}\n`);
  }
  return null;
}

/** Put every rewritten file back, after a failed build. */
function restore(edits: readonly Edit[]): void {
  for (const edit of edits) writeFileSync(edit.path, edit.before, "utf8");
}

function run(cwd: string, args: string[], proc: NodeJS.Process): boolean {
  const res = spawnSync("git", ["-C", cwd, ...args], { stdio: "inherit" });
  if (res.error) {
    proc.stderr.write(`  ! git: ${res.error.message}\n`);
    return false;
  }
  return res.status === 0;
}

function describeSync(paths: readonly string[]): string {
  if (paths.length === 0) return "(none configured)";
  return paths.join(", ");
}

/** Relative path for display, falling back to the absolute one. */
export function displayPath(root: string, abs: string): string {
  const rel = relative(root, abs);
  return rel && !rel.startsWith("..") ? rel : abs;
}

export const releaseCommand = buildCommand({
  func: runRelease,
  parameters: {
    flags: {
      bump: {
        kind: "parsed",
        parse: parseBumpKind,
        brief: "Which segment to increment: major, minor, or patch",
        default: "patch",
      },
      branch: {
        kind: "parsed",
        parse: String,
        brief: "Branch releases are allowed from",
        default: "main",
      },
      build: {
        kind: "boolean",
        brief: "Run project.commands.build (use --no-build to skip)",
        default: true,
      },
      tag: {
        kind: "boolean",
        brief: "Create the v<version> tag (use --no-tag to skip)",
        default: true,
      },
      dryRun: {
        kind: "boolean",
        brief: "Show the plan without writing, building, or tagging",
        default: false,
      },
      yes: {
        kind: "boolean",
        brief: "Skip the confirmation prompt",
        default: false,
      },
      interaction: {
        kind: "boolean",
        brief: "Confirm before releasing (use --no-interaction to disable)",
        default: true,
      },
    },
  },
  docs: {
    brief: "Cut a release: bump the version, sync it, build, commit, and tag",
    fullDescription:
      "Bumps `project.dist.version` in .claude/.jarrin.yml — the source of truth " +
      "for this project's version — mirrors the new number into every file listed " +
      "under `project.dist.sync`, runs `project.commands.build`, then commits the " +
      "tree and creates an annotated tag v<version>.\n\n" +
      "Refuses to run unless you are on the release branch (`main` by default, " +
      "see --branch) with a clean working tree, and refuses to reuse an existing " +
      "tag. Without --bump it increments the patch segment (0.1.3 -> 0.1.4).\n\n" +
      "Ordering is deliberate: the version is written before the build so the " +
      "artifact carries it, and the commit happens after, so a failed build rolls " +
      "every edit back and leaves the tree untouched.\n\n" +
      'Sync handlers are chosen by filename — *.json (top-level "version"), ' +
      ".env* (APP_VERSION), *.toml ([project] / [tool.poetry]), and *.yml/*.yaml " +
      "(top-level version). Files are rewritten in place; formatting is preserved.\n\n" +
      "Nothing is pushed: the commit and tag stay local and the push command is " +
      "printed for you to run.",
  },
});
