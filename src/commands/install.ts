import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

import { buildCommand } from "@stricli/core";

import type { LocalContext } from "../context.js";
import { loadPrompts, resolveInteractive } from "../interaction.js";
import { BINARY_REL_PATH, BUILD_BINARY_COMMAND } from "../release/binary.js";
import { findRepoRoot } from "../selfpath.js";

interface InstallFlags {
  readonly withGitleaks: boolean;
  readonly yes: boolean;
  readonly interaction: boolean;
}

interface LinkSpec {
  readonly src: string;
  readonly dest: string;
}

/**
 * Machine setup (port of the old `bin/install`): symlink the config into
 * `~/.claude`, enable the git hooks, and check prerequisites. Idempotent.
 */
async function runInstall(
  this: LocalContext,
  flags: InstallFlags,
): Promise<void> {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);
  const info = (msg: string): void => void proc.stdout.write(`  ${msg}\n`);
  const warn = (msg: string): void => void proc.stderr.write(`  ! ${msg}\n`);

  const repoDir = findRepoRoot(proc);
  if (!repoDir) {
    proc.stderr.write(
      "claudjar install: could not locate the jarrin-claude checkout from " +
        `${proc.execPath}.\n  Run install from inside the repo, or set ` +
        "JARRIN_REPO=/path/to/jarrin-claude.\n",
    );
    proc.exitCode = 1;
    return;
  }
  const claudeHome = proc.env.CLAUDE_HOME ?? join(homedir(), ".claude");
  const localBin = join(homedir(), ".local", "bin");
  const gitleaksBinDir = proc.env.GITLEAKS_BIN_DIR ?? localBin;
  const claudjarBinDir = proc.env.CLAUDJAR_BIN_DIR ?? localBin;
  const interactive = resolveInteractive(this, flags.interaction);

  const confirm = async (question: string): Promise<boolean> => {
    if (flags.yes) return true;
    if (!interactive) {
      warn(`${question} — skipped (non-interactive; pass --yes to overwrite).`);
      return false;
    }
    const p = await loadPrompts();
    const answer = await p.confirm({ message: question, initialValue: false });
    return answer === true;
  };

  out("claudjar install\n");
  info(`repo:        ${repoDir}`);
  info(`claude home: ${claudeHome}`);
  out("\n");

  mkdirSync(claudeHome, { recursive: true });

  const links: LinkSpec[] = [
    {
      src: join(repoDir, "claude", "CLAUDE.md"),
      dest: join(claudeHome, "CLAUDE.md"),
    },
    {
      src: join(repoDir, "claude", "settings.json"),
      dest: join(claudeHome, "settings.json"),
    },
    { src: join(repoDir, "claude", "rules"), dest: join(claudeHome, "rules") },
    {
      src: join(repoDir, "claude", "skills"),
      dest: join(claudeHome, "skills"),
    },
    {
      src: join(repoDir, "claude", "references"),
      dest: join(claudeHome, "references"),
    },
  ];

  out(`Linking config into ${claudeHome}:\n`);
  for (const spec of links) {
    await link(spec, { info, warn, confirm });
  }
  retireLauncherDir(join(claudeHome, "bin"), repoDir, { info });
  out("\n");

  // Expose `claudjar` on PATH by symlinking the standalone binary into a bin dir
  // (default ~/.local/bin, overridable via CLAUDJAR_BIN_DIR). That symlink is
  // also what claude/settings.json points its hooks at, so a missing binary
  // breaks the statusline and SessionStart everywhere — hence the offer to build
  // it now rather than a warning the user might scroll past.
  out(`Exposing the claudjar command in ${claudjarBinDir}:\n`);
  const binary = join(repoDir, BINARY_REL_PATH);
  if (!existsSync(binary)) {
    warn(`binary not built at ${binary}.`);
    const build = await confirm(`build it now (${BUILD_BINARY_COMMAND})?`);
    if (build) {
      info(`$ ${BUILD_BINARY_COMMAND}`);
      const res = spawnSync(BUILD_BINARY_COMMAND, {
        cwd: repoDir,
        shell: true,
        stdio: "inherit",
      });
      if (res.status !== 0) {
        warn(`build failed (exit ${String(res.status ?? "?")}).`);
      }
    }
  }

  if (existsSync(binary)) {
    mkdirSync(claudjarBinDir, { recursive: true });
    await link(
      { src: binary, dest: join(claudjarBinDir, "claudjar") },
      { info, warn, confirm },
    );
    if (!onPath(proc, claudjarBinDir)) {
      warn(
        `note: ${claudjarBinDir} is not on PATH; add it so \`claudjar\` resolves.`,
      );
    }
  } else {
    warn(
      `skipped the PATH link — build with '${BUILD_BINARY_COMMAND}' and re-run ` +
        `'claudjar install'.`,
    );
    warn(
      "until then the statusline and SessionStart hook in settings.json have " +
        "nothing to call.",
    );
  }
  out("\n");

  out("Enabling git hooks (secret scanning):\n");
  const git = spawnSync("git", [
    "-C",
    repoDir,
    "config",
    "core.hooksPath",
    ".githooks",
  ]);
  if (git.status === 0) {
    info("core.hooksPath = .githooks");
  } else {
    warn("failed to set core.hooksPath (is this a git repo?).");
  }
  out("\n");

  out("Checking prerequisites:\n");
  info(`node: ${proc.version} - CLI + SessionStart hook OK`);

  if (hasBinary("gitleaks")) {
    info("gitleaks present - pre-commit scan active");
  } else if (flags.withGitleaks) {
    warn("gitleaks NOT found - installing (--with-gitleaks)...");
    const ok = await installGitleaks(gitleaksBinDir, { info, warn });
    if (ok) {
      info(`installed gitleaks -> ${join(gitleaksBinDir, "gitleaks")}`);
      if (!onPath(proc, gitleaksBinDir)) {
        warn(
          `note: ${gitleaksBinDir} is not on PATH; add it so git hooks find gitleaks.`,
        );
      }
    } else {
      warn("gitleaks install did not complete; pre-commit will skip scanning.");
    }
  } else {
    warn(
      "gitleaks NOT found - the pre-commit hook will skip scanning (commits still work).",
    );
    warn(
      "  re-run with --with-gitleaks to auto-download it, or 'brew install gitleaks'.",
    );
  }
  out("\n");

  out("Done. Restart Claude Code sessions to pick up the new settings.\n");
}

interface Reporter {
  readonly info: (msg: string) => void;
  readonly warn: (msg: string) => void;
  readonly confirm: (question: string) => Promise<boolean>;
}

/**
 * Symlink `src` → `dest`. An existing correct symlink is left alone; a real
 * file/dir is backed up to `*.pre-jarrin.bak` after confirmation.
 */
async function link(spec: LinkSpec, r: Reporter): Promise<void> {
  const { src, dest } = spec;
  if (!existsSync(src)) {
    r.warn(`source missing, skipped: ${src}`);
    return;
  }

  const linkTarget = lsymlink(dest);
  if (linkTarget !== null) {
    if (linkTarget === src) {
      r.info(`ok   ${dest} -> ${src} (already linked)`);
      return;
    }
    if (
      !(await r.confirm(
        `replace symlink ${dest} (currently -> ${linkTarget})?`,
      ))
    ) {
      r.warn(`skipped ${dest}`);
      return;
    }
    rmSync(dest);
  } else if (existsSync(dest)) {
    const kind = statSync(dest).isDirectory() ? "directory" : "file";
    if (!(await r.confirm(`back up and replace existing ${kind} ${dest}?`))) {
      r.warn(`skipped ${dest}`);
      return;
    }
    renameSync(dest, `${dest}.pre-jarrin.bak`);
    r.info(`backed up ${dest} -> ${basename(dest)}.pre-jarrin.bak`);
  }

  symlinkSync(src, dest);
  r.info(`linked ${dest} -> ${src}`);
}

/**
 * Remove the `~/.claude/bin` symlink left by earlier installs.
 *
 * That directory held shell launchers which settings.json used to call. Both the
 * hooks and the statusline now invoke the binary on PATH directly, so the link
 * points at a directory this repo no longer ships. Only a symlink into *this*
 * checkout is removed — anything else is somebody's own file and is left alone.
 */
function retireLauncherDir(
  dest: string,
  repoDir: string,
  r: Pick<Reporter, "info">,
): void {
  const target = lsymlink(dest);
  if (target === null || !target.startsWith(repoDir)) return;
  rmSync(dest);
  r.info(`removed ${dest} (launchers retired; settings.json calls claudjar)`);
}

/** Return a symlink's target, or null if `path` is not a symlink. */
function lsymlink(path: string): string | null {
  try {
    if (lstatSync(path).isSymbolicLink()) return readlinkSync(path);
  } catch {
    /* not present */
  }
  return null;
}

/** Best-effort download of the latest gitleaks release into `binDir`. */
async function installGitleaks(
  binDir: string,
  r: Pick<Reporter, "info" | "warn">,
): Promise<boolean> {
  const os = platformSlug();
  const arch = archSlug();
  if (!os || !arch) {
    r.warn(
      `unsupported platform ${process.platform}/${process.arch}; install gitleaks manually.`,
    );
    return false;
  }

  let tmp: string | undefined;
  try {
    const release = (await (
      await fetch(
        "https://api.github.com/repos/gitleaks/gitleaks/releases/latest",
        {
          headers: { "User-Agent": "claudjar-installer" },
        },
      )
    ).json()) as {
      assets?: { name?: string; browser_download_url?: string }[];
    };

    const suffix = `_${os}_${arch}.tar.gz`;
    const asset = release.assets?.find((a) => a.name?.endsWith(suffix));
    if (!asset?.browser_download_url) {
      r.warn(`no gitleaks release asset for ${os}_${arch}.`);
      return false;
    }

    tmp = mkdtempSync(join(tmpdir(), "gitleaks-"));
    r.info(`downloading ${asset.browser_download_url}`);
    const tarPath = join(tmp, "gl.tar.gz");
    const res = await fetch(asset.browser_download_url);
    if (!res.ok) {
      r.warn(`download failed (HTTP ${String(res.status)}).`);
      return false;
    }
    writeFileSync(tarPath, Buffer.from(await res.arrayBuffer()));

    const untar = spawnSync("tar", ["-xzf", tarPath, "-C", tmp, "gitleaks"]);
    if (untar.status !== 0) {
      r.warn("gitleaks extract failed (is `tar` installed?).");
      return false;
    }

    mkdirSync(binDir, { recursive: true });
    const finalPath = join(binDir, "gitleaks");
    renameSync(join(tmp, "gitleaks"), finalPath);
    chmodSync(finalPath, 0o755);
    return true;
  } catch (e) {
    r.warn(`gitleaks download/extract failed: ${String(e)}`);
    return false;
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

function hasBinary(name: string): boolean {
  if (process.platform === "win32") {
    return spawnSync("where", [name]).status === 0;
  }
  // `command -v` is a shell builtin, so run it via `sh -c` rather than passing
  // args alongside `shell: true` (which Node deprecates, DEP0190).
  return spawnSync("sh", ["-c", `command -v "${name}"`]).status === 0;
}

function onPath(proc: NodeJS.Process, dir: string): boolean {
  return (proc.env.PATH ?? "").split(":").includes(dir);
}

function platformSlug(): "linux" | "darwin" | null {
  if (process.platform === "linux") return "linux";
  if (process.platform === "darwin") return "darwin";
  return null;
}

function archSlug(): "x64" | "arm64" | null {
  if (process.arch === "x64") return "x64";
  if (process.arch === "arm64") return "arm64";
  return null;
}

export const installCommand = buildCommand({
  func: runInstall,
  parameters: {
    flags: {
      withGitleaks: {
        kind: "boolean",
        brief: "Download the gitleaks binary if it is missing",
        default: false,
      },
      yes: {
        kind: "boolean",
        brief: "Overwrite existing files without prompting",
        default: false,
      },
      interaction: {
        kind: "boolean",
        brief: "Prompt before overwriting (use --no-interaction to disable)",
        default: true,
      },
    },
  },
  docs: {
    brief:
      "Symlink the config into ~/.claude, enable hooks, check prerequisites",
  },
});
