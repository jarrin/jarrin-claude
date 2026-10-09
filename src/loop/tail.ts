import { open, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";

import type { LogLine } from "../../monitor/shared/protocol.js";

/**
 * Live output for Bash calls that redirect to a file. A command like
 * `task check > /tmp/check.log 2>&1` shows nothing until it ends, so while it
 * runs the loop follows that file and forwards what is appended as `tail`
 * lines, paired with the call. The tail ends when Claude Code reports the task
 * finished (`system/task_notification` — the only end signal for a backgrounded
 * call), when a foreground call's result arrives, or when the session ends.
 */

/** Where a quoted or bare shell word ends. */
const WORD = `("[^"]+"|'[^']+'|[^\\s;&|<>()]+)`;
/** A stdout / stderr / both redirect (`>`, `>>`, `2>`, `&>`) to a file, not `>&1`. */
const REDIRECT = new RegExp(
  `(?:^|[^<>&\\w=-])(?:[12&])?>>?\\|?\\s*(?![&\\s])${WORD}`,
  "g",
);
const TEE = new RegExp(`\\btee\\s+(?:-a\\s+)?${WORD}`, "g");
const CD = new RegExp(`(?:^|[;&|(]\\s*)cd\\s+${WORD}`, "g");

const unquote = (w: string): string => w.replace(/^(["'])(.*)\1$/, "$2");

function expand(path: string, cwd: string): string {
  const home = path === "~" || path.startsWith("~/");
  const p = home ? homedir() + path.slice(1) : path;
  return isAbsolute(p) ? p : resolve(cwd, p);
}

/**
 * The file a command writes its output to, as an absolute path — resolved
 * against the `cd`s before it — or `undefined` when it writes to none (or only
 * to a device such as `/dev/null`).
 */
export function redirectTarget(
  command: string,
  cwd: string,
): string | undefined {
  const found = [...command.matchAll(REDIRECT), ...command.matchAll(TEE)]
    .map((m) => ({ at: m.index, word: unquote(m[1] ?? "") }))
    .filter(
      (m) => m.word && !m.word.startsWith("/dev/") && !m.word.includes("$"),
    )
    .sort((a, b) => a.at - b.at)[0];
  if (!found) return undefined;
  let dir = cwd;
  for (const cd of command.matchAll(CD)) {
    if (cd.index > found.at) break;
    const target = unquote(cd[1] ?? "");
    if (target.includes("$")) return undefined;
    dir = expand(target, dir);
  }
  return expand(found.word, dir);
}

/** File access, injectable for tests. */
export interface TailFs {
  /** The file's size, or `undefined` while it does not exist. */
  size(path: string): Promise<number | undefined>;
  read(path: string, from: number, length: number): Promise<Buffer>;
}

export const nodeFs: TailFs = {
  size: async (path) => {
    try {
      return (await stat(path)).size;
    } catch {
      return undefined;
    }
  },
  read: async (path, from, length) => {
    const fh = await open(path, "r");
    try {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, from);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  },
};

export interface TailOptions {
  /** The session's working directory, for relative paths. */
  readonly cwd: string;
  readonly emit: (lines: LogLine[]) => void;
  readonly now: () => number;
  readonly fs?: TailFs;
  readonly intervalMs?: number;
  /** Stop following a file whose task never reports back. */
  readonly maxMs?: number;
}

/** At most this much is read per poll; a bigger burst keeps only its end. */
const MAX_READ = 64 * 1024;

interface Tail {
  readonly file: string;
  readonly issue: number;
  readonly background: boolean;
  readonly started: number;
  offset: number;
  decoder: StringDecoder;
  /** Polls run one after another, never overlapping. */
  chain: Promise<void>;
  timer: ReturnType<typeof setInterval> | undefined;
}

export class LogTails {
  private readonly tails = new Map<string, Tail>();
  private readonly fs: TailFs;

  constructor(private readonly opts: TailOptions) {
    this.fs = opts.fs ?? nodeFs;
  }

  /** Watch one raw stream-json line for tails to start and stop. */
  feed(raw: string, issue: number): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const rec = record(msg);
    if (rec.type === "assistant")
      for (const b of blocks(rec.message)) {
        if (b.type !== "tool_use" || b.name !== "Bash") continue;
        const input = record(b.input);
        const command = typeof input.command === "string" ? input.command : "";
        const file = redirectTarget(command, this.opts.cwd);
        if (file && typeof b.id === "string")
          this.start(b.id, file, issue, input.run_in_background === true);
      }
    else if (rec.type === "user")
      for (const b of blocks(rec.message)) {
        if (b.type !== "tool_result" || typeof b.tool_use_id !== "string")
          continue;
        const tail = this.tails.get(b.tool_use_id);
        // A backgrounded call answers at once; its task ends later.
        if (
          tail &&
          !tail.background &&
          !/running in background/i.test(text(b.content))
        )
          void this.stop(b.tool_use_id);
      }
    else if (rec.type === "system" && rec.subtype === "task_notification") {
      if (typeof rec.tool_use_id === "string") void this.stop(rec.tool_use_id);
    } else if (rec.type === "result") void this.stopAll();
  }

  /** End every tail (the session ended); resolves once their last lines are out. */
  async stopAll(): Promise<void> {
    await Promise.all([...this.tails.keys()].map((call) => this.stop(call)));
  }

  private start(
    call: string,
    file: string,
    issue: number,
    background: boolean,
  ): void {
    if (this.tails.has(call)) return;
    const tail: Tail = {
      file,
      issue,
      background,
      started: this.opts.now(),
      offset: 0,
      decoder: new StringDecoder("utf8"),
      chain: Promise.resolve(),
      timer: undefined,
    };
    this.tails.set(call, tail);
    // What the file held before the command ran is not its output.
    tail.chain = this.fs.size(file).then((size) => {
      tail.offset = size ?? 0;
    });
    tail.timer = setInterval(() => {
      if (this.opts.now() - tail.started > (this.opts.maxMs ?? 2 * 3600_000))
        void this.stop(call);
      else tail.chain = tail.chain.then(() => this.poll(call, tail, false));
    }, this.opts.intervalMs ?? 1000);
  }

  private stop(call: string): Promise<void> {
    const tail = this.tails.get(call);
    if (!tail) return Promise.resolve();
    this.tails.delete(call);
    clearInterval(tail.timer);
    tail.chain = tail.chain.then(() => this.poll(call, tail, true));
    return tail.chain;
  }

  private async poll(call: string, tail: Tail, done: boolean): Promise<void> {
    let chunk = "";
    try {
      const size = await this.fs.size(tail.file);
      if (size !== undefined) {
        // Truncated (`>` reopened it): start over from the top.
        if (size < tail.offset) {
          tail.offset = 0;
          tail.decoder = new StringDecoder("utf8");
        }
        if (size > tail.offset) {
          const skipped = size - tail.offset > MAX_READ;
          const from = skipped ? size - MAX_READ : tail.offset;
          const buf = await this.fs.read(tail.file, from, size - from);
          if (skipped) tail.decoder = new StringDecoder("utf8");
          chunk = (skipped ? "…\n" : "") + tail.decoder.write(buf);
          tail.offset = from + buf.length;
        }
      }
    } catch {
      // Unreadable for now (permissions, a race with a rename): try again later.
    }
    if (done) chunk += tail.decoder.end();
    if (!chunk && !done) return;
    this.opts.emit([
      {
        t: this.opts.now(),
        issue: tail.issue,
        kind: "tail",
        text: chunk,
        call,
        detail: { type: "tail", file: tail.file, done },
      },
    ]);
  }
}

function record(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object"
    ? (v as Record<string, unknown>)
    : {};
}

function blocks(message: unknown): Record<string, unknown>[] {
  const content = record(message).content;
  return Array.isArray(content) ? (content as unknown[]).map(record) : [];
}

function text(content: unknown): string {
  if (typeof content === "string") return content;
  return Array.isArray(content)
    ? (content as unknown[])
        .map((c) => record(c).text)
        .filter((t): t is string => typeof t === "string")
        .join("\n")
    : "";
}
