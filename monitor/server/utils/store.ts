import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Hub } from "./hub";
import type { Saved } from "./hub";
import { parseSaved } from "./schema";

const DEBOUNCE_MS = 250;

/**
 * The hub's state as one JSON file. Writes are debounced and atomic (temp file +
 * rename), so a crash mid-write never leaves a torn file; a file that fails to
 * parse is set aside rather than silently overwritten with an empty state.
 */
export class StateFile {
  private pending: Saved | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly path: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.path = join(dir, "state.json");
  }

  load(): Saved | null {
    let raw: string;
    try {
      raw = readFileSync(this.path, "utf8");
    } catch {
      return null;
    }
    const saved = parseSaved(raw);
    if (!saved) {
      const aside = `${this.path}.corrupt-${String(Date.now())}`;
      renameSync(this.path, aside);
      console.error(`claudjar monitor: unreadable state moved to ${aside}`);
    }
    return saved;
  }

  save(saved: Saved): void {
    this.pending = saved;
    this.timer ??= setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  flush(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return;
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.pending));
    renameSync(tmp, this.path);
    this.pending = null;
  }
}

let state: StateFile | null = null;
let hub: Hub | null = null;

/** The one hub of this server process, restored from `NUXT_DATA_DIR`. */
export function useHub(): Hub {
  if (!hub) {
    state = new StateFile(useRuntimeConfig().dataDir);
    hub = new Hub(Date.now, (saved) => state?.save(saved));
    const saved = state.load();
    if (saved) hub.restore(saved);
  }
  return hub;
}

/** Write any debounced state now (on shutdown). */
export function flushState(): void {
  state?.flush();
}
