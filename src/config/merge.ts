import type { JarrinConfig, WorktreeConfig } from "./schema.js";
import { emptyConfig } from "./schema.js";

/**
 * Merge a gitignored `.jarrin.local.yml` (`local`) over the committed
 * `.jarrin.yml` (`base`) into the effective config the CLI acts on.
 *
 * **Only `worktree:` is overridable.** Every other key — the rule tiers, the
 * command table, `backup`, the `project:` block (stack + release surface), and
 * `hooks:` — is taken from `base` verbatim; declaring them in the local file has
 * no effect (deliberately: they are committed, shared config). The local file
 * exists to carry machine-specific worktree settings out of git. If a future key
 * needs a per-machine override, widen this function explicitly.
 *
 * Within `worktree:`, local wins: `dir`/`name` when non-empty, `port` when
 * non-zero (a worktree's stamped assignment overrides the base's 0), `copy` as an
 * order-preserving union (base first), and `setup` replaced wholesale when local
 * declares any commands (a bootstrap sequence is atomic).
 */
export function mergeConfig(
  base: JarrinConfig,
  local: JarrinConfig,
): JarrinConfig {
  const merged = emptyConfig();
  merged.rules.push(...base.rules);
  merged.local.push(...base.local);
  merged.imports.push(...base.imports);
  merged.commands.push(...base.commands);
  merged.backup = base.backup;
  merged.project = {
    port: base.project.port,
    commands: { ...base.project.commands },
    dist: {
      version: base.project.dist.version,
      sync: [...base.project.dist.sync],
    },
  };
  merged.hooks = {
    worktree: {
      create: [...base.hooks.worktree.create],
      remove: [...base.hooks.worktree.remove],
    },
  };
  merged.worktree = mergeWorktree(base.worktree, local.worktree);
  return merged;
}

function mergeWorktree(
  base: WorktreeConfig,
  local: WorktreeConfig,
): WorktreeConfig {
  return {
    dir: local.dir || base.dir,
    copy: unionStrings(base.copy, local.copy),
    setup: local.setup.length > 0 ? [...local.setup] : [...base.setup],
    name: local.name || base.name,
    port: local.port || base.port,
  };
}

/** Order-preserving union (base first), dropping blanks and duplicates. */
function unionStrings(a: readonly string[], b: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...a, ...b]) {
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
