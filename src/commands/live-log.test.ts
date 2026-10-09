import { describe, expect, it } from "vitest";

import { liveTarget } from "./live-log.js";

const payload = {
  session_id: "s1",
  cwd: "/repo",
  tool_name: "Bash",
  tool_use_id: "toolu_1",
  tool_input: {
    command: "task check > /tmp/check.log 2>&1; tail /tmp/check.log",
  },
};
const env = { CLAUDJAR_MONITOR_URL: "wss://claudjar.example" };

describe("liveTarget", () => {
  it("follows a Bash call's output file, posting over https", () => {
    expect(liveTarget(payload, env, "box")).toEqual({
      url: "https://claudjar.example/api/live",
      post: {
        id: "toolu_1",
        file: "/tmp/check.log",
        command: payload.tool_input.command,
        source: { kind: "session", host: "box", where: "/repo", session: "s1" },
      },
    });
  });

  it("carries the token and maps ws to http", () => {
    const t = liveTarget(
      payload,
      {
        CLAUDJAR_MONITOR_URL: "ws://localhost:3911",
        CLAUDJAR_MONITOR_TOKEN: "k",
      },
      "box",
    );
    expect(t?.url).toBe("http://localhost:3911/api/live");
    expect(t?.post.token).toBe("k");
  });

  it("does nothing without a monitor, inside a loop, or with no output file", () => {
    expect(liveTarget(payload, {}, "box")).toBeNull();
    expect(
      liveTarget(payload, { ...env, CLAUDJAR_LOOP: "1" }, "box"),
    ).toBeNull();
    expect(
      liveTarget(
        { ...payload, tool_input: { command: "git status" } },
        env,
        "box",
      ),
    ).toBeNull();
    expect(
      liveTarget({ ...payload, tool_name: "Read" }, env, "box"),
    ).toBeNull();
  });
});
