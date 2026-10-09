import { readFile, readdir, readlink, stat } from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";

import { nodeFs } from "../loop/tail.js";
import type { TailFs } from "../loop/tail.js";

/**
 * Follows the file one Bash call writes its output to, from a hook process that
 * sees nothing of the call after it starts. The loop's own tails (`tail.ts`) end
 * on the session's stream-json; a hook has no such stream, so the end is read
 * off the system instead: the call is over once no process still holds the file
 * open for writing.
 */

export interface FollowFs extends TailFs {
  /** Last modification time in epoch ms, or `undefined` while it does not exist. */
  mtime(path: string): Promise<number | undefined>;
  /**
   * Whether any process holds `path` open for writing; `undefined` when that
   * cannot be known (no `/proc`).
   */
  writing(path: string): Promise<boolean | undefined>;
}

export const followFs: FollowFs = {
  ...nodeFs,
  mtime: async (path) => {
    try {
      return (await stat(path)).mtimeMs;
    } catch {
      return undefined;
    }
  },
  writing: procWriting,
};

/** O_ACCMODE bits that mean the descriptor can write (O_WRONLY, O_RDWR). */
const WRITE_MODES = new Set([1, 2]);

/** Scan `/proc/<pid>/fd` for a descriptor on `path` opened for writing. */
async function procWriting(path: string): Promise<boolean | undefined> {
  let pids: string[];
  try {
    pids = (await readdir("/proc")).filter((p) => /^\d+$/.test(p));
  } catch {
    return undefined;
  }
  for (const pid of pids) {
    let fds: string[];
    try {
      fds = await readdir(`/proc/${pid}/fd`);
    } catch {
      continue; // another user's process, or gone already
    }
    for (const fd of fds) {
      try {
        if ((await readlink(`/proc/${pid}/fd/${fd}`)) !== path) continue;
        const info = await readFile(`/proc/${pid}/fdinfo/${fd}`, "utf8");
        const flags = /^flags:\s*([0-7]+)/m.exec(info)?.[1];
        if (flags && WRITE_MODES.has(parseInt(flags, 8) & 3)) return true;
      } catch {
        // closed between the listing and the read
      }
    }
  }
  return false;
}

export interface FollowOptions {
  readonly file: string;
  /** Hand over the next chunk; resolves false when it did not arrive (retried). */
  readonly send: (chunk: string, done: boolean) => Promise<boolean>;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly fs?: FollowFs;
  readonly intervalMs?: number;
  /** With no writer ever seen (a call that ended before the first look), stop after this long. */
  readonly graceMs?: number;
  /** Without `/proc`, stop once the file has not grown for this long. */
  readonly idleMs?: number;
  readonly maxMs?: number;
}

/** At most this much is read per poll; a bigger burst keeps only its end. */
const MAX_READ = 64 * 1024;
/** What is held back while the monitor is unreachable; only the end is kept. */
const MAX_PENDING = 256 * 1024;

/** Follow `file` until its writer is gone, sending what is appended. */
export async function follow(opts: FollowOptions): Promise<void> {
  const fs = opts.fs ?? followFs;
  const interval = opts.intervalMs ?? 1000;
  const started = opts.now();
  // A file the command already rewrote is all output; an older one is not.
  const mtime = await fs.mtime(opts.file);
  let offset =
    mtime !== undefined && mtime < started - interval
      ? ((await fs.size(opts.file)) ?? 0)
      : 0;
  let decoder = new StringDecoder("utf8");
  let pending = "";
  let sawWriter = false;
  let lastGrowth = started;

  for (;;) {
    const writing = await fs.writing(opts.file);
    if (writing) sawWriter = true;
    try {
      const size = await fs.size(opts.file);
      if (size !== undefined) {
        // Truncated (`>` reopened it): start over from the top.
        if (size < offset) {
          offset = 0;
          decoder = new StringDecoder("utf8");
        }
        if (size > offset) {
          const skipped = size - offset > MAX_READ;
          const from = skipped ? size - MAX_READ : offset;
          const buf = await fs.read(opts.file, from, size - from);
          if (skipped) decoder = new StringDecoder("utf8");
          pending += (skipped ? "…\n" : "") + decoder.write(buf);
          offset = from + buf.length;
          lastGrowth = opts.now();
        }
      }
    } catch {
      // Unreadable for now (permissions, a race with a rename): try again later.
    }
    const elapsed = opts.now() - started;
    const done =
      elapsed > (opts.maxMs ?? 2 * 3600_000) ||
      (writing === undefined
        ? opts.now() - lastGrowth > (opts.idleMs ?? 10 * 60_000)
        : !writing && (sawWriter || elapsed > (opts.graceMs ?? 5000)));
    if (done) pending += decoder.end();
    if (pending || done) {
      if (await opts.send(pending, done)) pending = "";
      else if (done)
        return; // the monitor is unreachable; give up quietly
      else pending = pending.slice(-MAX_PENDING);
    }
    if (done) return;
    await opts.sleep(interval);
  }
}
