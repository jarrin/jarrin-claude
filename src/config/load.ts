import { readFileSync } from "node:fs";
import { join } from "node:path";

import { mergeConfig } from "./merge.js";
import { parseConfig } from "./read.js";
import type { JarrinConfig } from "./schema.js";
import { emptyConfig } from "./schema.js";

/** Base config filename (committed). */
export const BASE_FILE = ".jarrin.yml";
/** Local-override filename (gitignored). */
export const LOCAL_FILE = ".jarrin.local.yml";

export interface LoadedConfig {
  /** Committed `.jarrin.yml`, or an empty config when absent. */
  readonly base: JarrinConfig;
  /** Gitignored `.jarrin.local.yml`, or an empty config when absent. */
  readonly local: JarrinConfig;
  /** `local` merged over `base` — what the hook and CLI act on. */
  readonly merged: JarrinConfig;
  readonly hasBase: boolean;
  readonly hasLocal: boolean;
}

/**
 * Load the effective config for a repo's `.claude` dir: parse the committed
 * `.jarrin.yml` and the gitignored `.jarrin.local.yml`, and merge the latter
 * over the former (see {@link mergeConfig}). Missing files parse to an empty
 * config so the caller can decide whether a missing base is fatal.
 */
export function loadEffectiveConfig(claudeDir: string): LoadedConfig {
  const baseText = readIfPresent(join(claudeDir, BASE_FILE));
  const localText = readIfPresent(join(claudeDir, LOCAL_FILE));
  const base = baseText !== null ? parseConfig(baseText) : emptyConfig();
  const local = localText !== null ? parseConfig(localText) : emptyConfig();
  return {
    base,
    local,
    merged: mergeConfig(base, local),
    hasBase: baseText !== null,
    hasLocal: localText !== null,
  };
}

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
