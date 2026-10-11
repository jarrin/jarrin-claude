import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { backlogRepo } from "../commands/loop.js";
import { BASE_FILE } from "../config/load.js";

/**
 * Project discovery: which directories under `projects_dir` the service offers.
 *
 * A project is a direct child that is a git repository's MAIN checkout — its
 * `.git` is a directory. Two things that live beside the projects are excluded:
 *
 * - **linked worktrees**, whose `.git` is a file (`gitdir: …`) pointing back into
 *   the main checkout. A `worktree.dir: ../` recipe lands them right next to the
 *   repos, so they look like projects by every other measure.
 * - **`<repo>-worktrees/`**, the default grouping folder `claudjar worktree
 *   create` puts them in. It is not a repo itself, but the name is excluded
 *   outright so a stray `git init` inside it cannot promote it.
 *
 * The split is IO ({@link scanProjectsDir}) feeding a pure classifier
 * ({@link discoverProjects}), so the rules are testable without a filesystem.
 */

export type GitKind = "dir" | "file" | "none";

/** What the scan observed about one direct child of `projects_dir`. */
export interface DirEntry {
  readonly name: string;
  readonly path: string;
  readonly git: GitKind;
  /** The text of `.claude/.jarrin.yml`, or null when it does not exist. */
  readonly jarrinYml: string | null;
}

export interface Project {
  readonly name: string;
  readonly path: string;
  /** Has `.claude/.jarrin.yml`, i.e. opted in to claudjar. */
  readonly configured: boolean;
  /** `backlog.plan.repo`, else `backlog.repo`; empty when neither is set. */
  readonly backlogRepo: string;
}

export const WORKTREES_SUFFIX = "-worktrees";

/** Classify scanned entries into projects, sorted by name. Pure. */
export function discoverProjects(entries: readonly DirEntry[]): Project[] {
  return entries
    .filter(
      (e) =>
        e.git === "dir" &&
        !e.name.startsWith(".") &&
        !e.name.endsWith(WORKTREES_SUFFIX),
    )
    .map((e) => ({
      name: e.name,
      path: e.path,
      configured: e.jarrinYml !== null,
      backlogRepo: e.jarrinYml === null ? "" : backlogRepo(e.jarrinYml),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function gitKind(dir: string): GitKind {
  try {
    const st = statSync(join(dir, ".git"));
    if (st.isDirectory()) return "dir";
    return st.isFile() ? "file" : "none";
  } catch {
    return "none";
  }
}

function readOptional(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * Read the direct children of `projectsDir`. Throws when the directory itself
 * cannot be read — an unreadable projects dir is a config error, not "no projects".
 * Symlinked directories count (statSync follows them).
 */
export function scanProjectsDir(projectsDir: string): DirEntry[] {
  const out: DirEntry[] = [];
  for (const name of readdirSync(projectsDir)) {
    const path = join(projectsDir, name);
    try {
      if (!statSync(path).isDirectory()) continue;
    } catch {
      continue; // a dangling symlink
    }
    const git = gitKind(path);
    out.push({
      name,
      path,
      git,
      jarrinYml:
        git === "dir" ? readOptional(join(path, ".claude", BASE_FILE)) : null,
    });
  }
  return out;
}
