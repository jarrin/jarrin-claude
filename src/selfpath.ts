import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Locating the jarrin-claude checkout from inside a running claudjar.
 *
 * `install` needs the repo it was built from, because that is what it symlinks
 * into `~/.claude`. Deriving it from the module's own path stopped being enough
 * once the CLI shipped as a Node SEA binary: an executable with the script
 * embedded has no meaningful `__filename`, and `import.meta.url` cannot be used
 * at all in the CommonJS bundle SEA requires.
 *
 * So instead of one clever answer, this tries several honest ones in order of
 * trustworthiness and takes the first that actually looks like the repo.
 */

/** Marker files that identify a jarrin-claude checkout root. */
function isRepoRoot(dir: string): boolean {
  return (
    existsSync(join(dir, "claude", "rules")) &&
    existsSync(join(dir, "package.json"))
  );
}

/** Walk up from `start`, at most `limit` levels, looking for the repo root. */
function walkUp(start: string, limit = 8): string | null {
  let dir = start;
  for (let i = 0; i < limit; i++) {
    if (isRepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Resolve symlinks so `~/.local/bin/claudjar` maps back into `dist/build/`. */
function realDir(path: string): string | null {
  try {
    return dirname(realpathSync(path));
  } catch {
    return null;
  }
}

/**
 * Find the jarrin-claude repo root, or null when nothing plausible is nearby.
 *
 * Order: an explicit `JARRIN_REPO` override (always wins — the escape hatch when
 * the binary has been copied somewhere unrelated), then the executable's own
 * location (correct for the SEA binary, whose `execPath` is the binary itself),
 * then the entry script (correct for `node dist/claudjar.cjs` and `tsx src/cli.ts`),
 * then the working directory (correct when you are simply standing in the repo).
 */
export function findRepoRoot(proc: NodeJS.Process): string | null {
  const override = proc.env.JARRIN_REPO?.trim();
  if (override) {
    const dir = resolve(override);
    return isRepoRoot(dir) ? dir : null;
  }

  const candidates: string[] = [];
  const exec = realDir(proc.execPath);
  if (exec) candidates.push(exec);
  const entry = proc.argv[1];
  if (entry) {
    const dir = realDir(entry);
    if (dir) candidates.push(dir);
  }
  candidates.push(proc.cwd());

  for (const candidate of candidates) {
    const root = walkUp(candidate);
    if (root) return root;
  }
  return null;
}
