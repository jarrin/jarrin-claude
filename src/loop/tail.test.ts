import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LogLine } from "../../monitor/shared/protocol.js";
import { LogTails, redirectTarget, type TailFs } from "./tail.js";

describe("redirectTarget", () => {
  it("finds the file stdout goes to, after the cds before it", () => {
    expect(
      redirectTarget(
        'cd /home/j/ai; timeout 1800 task --force check > /tmp/check.log 2>&1; echo "rc=$?" >> /tmp/check.log',
        "/repo",
      ),
    ).toBe("/tmp/check.log");
    expect(redirectTarget("cd sub && make >build.log", "/repo")).toBe(
      "/repo/sub/build.log",
    );
  });
  it("handles appends, &>, 2> and tee", () => {
    expect(redirectTarget("x >> out.txt", "/r")).toBe("/r/out.txt");
    expect(redirectTarget("x &> all.log", "/r")).toBe("/r/all.log");
    expect(redirectTarget("x 2> err.log", "/r")).toBe("/r/err.log");
    expect(redirectTarget("x 2>&1 | tee -a run.log", "/r")).toBe("/r/run.log");
    expect(redirectTarget('x > "my log.txt"', "/r")).toBe("/r/my log.txt");
  });
  it("ignores fd duplication, devices, variables and arrows", () => {
    expect(redirectTarget("x 2>&1", "/r")).toBeUndefined();
    expect(redirectTarget("x >/dev/null 2>&1", "/r")).toBeUndefined();
    expect(redirectTarget("x > $LOG", "/r")).toBeUndefined();
    expect(redirectTarget("rg -n '=> x' src", "/r")).toBeUndefined();
    expect(redirectTarget("git status", "/r")).toBeUndefined();
  });
});

/** An in-memory file the test grows between polls. */
function memoryFs(): TailFs & { content: Buffer | undefined } {
  const fs = {
    content: undefined as Buffer | undefined,
    size: () => Promise.resolve(fs.content?.length),
    read: (_: string, from: number, length: number) =>
      Promise.resolve(
        (fs.content ?? Buffer.alloc(0)).subarray(from, from + length),
      ),
  };
  return fs;
}

const bash = (id: string, command: string, background = false): string =>
  JSON.stringify({
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id,
          name: "Bash",
          input: { command, run_in_background: background },
        },
      ],
    },
  });
const result = (id: string, text: string): string =>
  JSON.stringify({
    type: "user",
    message: {
      content: [{ type: "tool_result", tool_use_id: id, content: text }],
    },
  });
const notification = (id: string): string =>
  JSON.stringify({
    type: "system",
    subtype: "task_notification",
    tool_use_id: id,
    status: "completed",
  });

describe("LogTails", () => {
  let fs: ReturnType<typeof memoryFs>;
  let lines: LogLine[];
  let tails: LogTails;

  beforeEach(() => {
    vi.useFakeTimers();
    fs = memoryFs();
    fs.content = Buffer.from("stale from an earlier run\n");
    lines = [];
    tails = new LogTails({
      cwd: "/r",
      emit: (l) => lines.push(...l),
      now: () => Date.now(),
      fs,
      intervalMs: 100,
    });
  });
  afterEach(() => vi.useRealTimers());

  const tick = () => vi.advanceTimersByTimeAsync(100);

  it("streams what the command appends, then ends on its result", async () => {
    tails.feed(bash("c1", "task check > /tmp/c.log 2>&1"), 7);
    await tick();
    fs.content = Buffer.from("step 1\n"); // `>` truncated, then wrote
    await tick();
    fs.content = Buffer.from("step 1\nstep 2\n");
    await tick();
    await tick(); // nothing new: no line
    tails.feed(result("c1", "ok"), 7);
    await vi.runOnlyPendingTimersAsync();
    expect(lines.map((l) => [l.text, l.detail])).toEqual([
      ["step 1\n", { type: "tail", file: "/tmp/c.log", done: false }],
      ["step 2\n", { type: "tail", file: "/tmp/c.log", done: false }],
      ["", { type: "tail", file: "/tmp/c.log", done: true }],
    ]);
    expect(lines.every((l) => l.call === "c1" && l.issue === 7)).toBe(true);
  });

  it("keeps a backgrounded call's tail until its task notification", async () => {
    tails.feed(bash("c2", "make > /tmp/m.log", true), 1);
    await tick();
    tails.feed(result("c2", "Command running in background with ID: x"), 1);
    fs.content = Buffer.concat([
      fs.content ?? Buffer.alloc(0),
      Buffer.from("more\n"),
    ]);
    await tick();
    expect(lines.at(-1)?.detail).toEqual({
      type: "tail",
      file: "/tmp/m.log",
      done: false,
    });
    tails.feed(notification("c2"), 1);
    await vi.runOnlyPendingTimersAsync();
    expect(lines.at(-1)?.detail).toEqual({
      type: "tail",
      file: "/tmp/m.log",
      done: true,
    });
  });

  it("ends every tail with the session", async () => {
    tails.feed(bash("c3", "a > /tmp/a.log"), 1);
    await tails.stopAll();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.detail).toEqual({
      type: "tail",
      file: "/tmp/a.log",
      done: true,
    });
  });

  it("does not follow a command without a redirect", async () => {
    tails.feed(bash("c4", "git status"), 1);
    await tick();
    await tails.stopAll();
    expect(lines).toEqual([]);
  });
});
