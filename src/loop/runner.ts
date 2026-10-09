import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

import type { RunClaude } from "./driver.js";
import type { Issue } from "./gitea.js";
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
}

/**
 * Spawn one headless `claude -p` session per call. A new process IS the cleared
 * context; `--resume` is only used to carry an issue across a usage-limit pause.
 * The raw stream-json is kept per issue under `logDir` for post-mortems.
 */
export function claudeRunner(opts: RunnerOptions): RunClaude {
  mkdirSync(opts.logDir, { recursive: true });
  return (prompt, resume, issue, watch) =>
    new Promise((resolve, reject) => {
      const args = [
        "-p",
        prompt,
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
        stdio: ["ignore", "pipe", "pipe"],
      });
      const tracker = new StreamTracker(watch);
      createInterface({ input: child.stdout }).on("line", (line) => {
        log.write(`${line}\n`);
        opts.onLine?.(line, issue);
        const shown = tracker.feed(line);
        if (shown) opts.out(`  ${shown.slice(0, 160)}`);
      });
      child.stderr.on("data", (chunk: Buffer) => void log.write(chunk));
      child.on("error", (err) => {
        log.end();
        reject(err);
      });
      child.on("close", (code) => {
        log.end();
        resolve(tracker.outcome(code));
      });
    });
}
