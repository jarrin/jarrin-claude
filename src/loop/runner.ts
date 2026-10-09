import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

import type { RunClaude } from "./driver.js";
import type { Issue } from "./gitea.js";
import { userMessage, withNotes } from "./input.js";
import type { InputBox } from "./input.js";
import { StreamTracker } from "./stream.js";

export interface RunnerOptions {
  readonly cwd: string;
  readonly logDir: string;
  readonly permissionMode: string;
  readonly model: string;
  readonly claudeBin: string;
  readonly out: (line: string) => void;
  /** Every raw stream-json line, e.g. for the live monitor. */
  readonly onLine?: (line: string, issue: Issue) => void;
  /** Notes from the user, fed into the running session. */
  readonly inputs?: InputBox;
}

/**
 * Spawn one headless `claude -p` session per call. A new process IS the cleared
 * context; `--resume` carries an issue across a usage-limit pause, an answer, or
 * a restart. The prompt goes in over stdin as stream-json, which keeps stdin open
 * for the user's notes mid-session; it is closed at the first `result`, which is
 * what lets the process exit. The raw stream-json is kept per issue under
 * `logDir` for post-mortems.
 */
export function claudeRunner(opts: RunnerOptions): RunClaude {
  mkdirSync(opts.logDir, { recursive: true });
  return (prompt, resume, issue, watch) =>
    new Promise((resolve, reject) => {
      const args = [
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--permission-mode",
        opts.permissionMode,
      ];
      if (opts.model) args.push("--model", opts.model);
      if (resume) args.push("--resume", resume);

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const log = createWriteStream(
        join(opts.logDir, `${stamp}-issue-${String(issue.number)}.jsonl`),
      );
      const child = spawn(opts.claudeBin, args, {
        cwd: opts.cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });
      // The process may exit before a late write lands; that is not an error.
      child.stdin.on("error", () => {});
      const write = (text: string): void => {
        if (child.stdin.writable) child.stdin.write(userMessage(text));
      };
      const notes =
        opts.inputs?.attach((text) => {
          log.write(`${JSON.stringify({ type: "claudjar_input", text })}\n`);
          write(text);
        }) ?? [];
      write(withNotes(prompt, notes));
      const endInput = (): void => {
        opts.inputs?.detach();
        child.stdin.end();
      };
      const tracker = new StreamTracker(watch);
      createInterface({ input: child.stdout }).on("line", (line) => {
        log.write(`${line}\n`);
        opts.onLine?.(line, issue);
        const shown = tracker.feed(line);
        if (tracker.finished) endInput();
        if (shown) opts.out(`  ${shown.slice(0, 160)}`);
      });
      child.stderr.on("data", (chunk: Buffer) => void log.write(chunk));
      child.on("error", (err) => {
        endInput();
        log.end();
        reject(err);
      });
      child.on("close", (code) => {
        endInput();
        log.end();
        resolve(tracker.outcome(code));
      });
    });
}
