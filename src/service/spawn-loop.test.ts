import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SCOPE_PREFIX } from "../session/launcher.js";
import { loopArgv, loopLogPath, selfCommand, spawnLoop } from "./spawn-loop.js";

const spec = {
  cwd: tmpdir(),
  repo: "o/web",
  milestone: { id: 7, title: "plan-x" },
  label: "web/plan-x",
};

const launch = (script: string) => ({
  bin: [process.execPath, "-e", script],
  scope: false,
  logDir: mkdtempSync(join(tmpdir(), "cj-loops-")),
  monitorUrl: "wss://m.example",
  monitorToken: "tok",
  env: process.env,
  settleMs: 300,
});

describe("loopArgv", () => {
  it("starts the loop on the milestone id, in a scope when available", () => {
    const bare = loopArgv(
      { bin: ["/bin/claudjar"], scope: false, monitorUrl: "wss://m" },
      spec,
    );
    expect(bare).toEqual([
      "/bin/claudjar",
      "loop",
      "7",
      "--repo",
      "o/web",
      "--monitor",
      "wss://m",
    ]);
    expect(
      loopArgv(
        { bin: ["/bin/claudjar"], scope: true, monitorUrl: "wss://m" },
        spec,
      ),
    ).toEqual([...SCOPE_PREFIX, ...bare]);
  });

  it("names the log after the label, and runs claudjar as this process does", () => {
    expect(loopLogPath("/l", "web/plan-x")).toBe("/l/web--plan-x.log");
    expect(
      selfCommand({
        execPath: "/usr/bin/node",
        argv: ["/usr/bin/node", "/r/cli.ts"],
      }),
    ).toEqual(["/usr/bin/node", "/r/cli.ts"]);
  });
});

describe("spawnLoop", () => {
  it("resolves with the pid of a loop that keeps running, its token in the env", async () => {
    const l = launch(
      "console.log(process.env.CLAUDJAR_MONITOR_TOKEN, process.argv.slice(1).join(' ')); setTimeout(() => {}, 5000)",
    );
    const { pid, log } = await spawnLoop(l, spec);
    try {
      expect(pid).toBeGreaterThan(0);
      expect(log).toBe(join(l.logDir, "web--plan-x.log"));
      expect(readFileSync(log, "utf8")).toContain(
        "tok loop 7 --repo o/web --monitor wss://m.example",
      );
    } finally {
      process.kill(pid);
    }
  });

  it("rejects with the log's tail when the loop exits at once", async () => {
    await expect(
      spawnLoop(
        launch(
          "console.error('loop: milestone \"plan-x\" is already being worked by another loop (pid 8)'); process.exit(1)",
        ),
        spec,
      ),
    ).rejects.toThrow(
      'the loop exited at once (code 1): loop: milestone "plan-x" is already being worked by another loop (pid 8)',
    );
  });
});
