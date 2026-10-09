import { describe, expect, it } from "vitest";

import type { InstanceInfo, WatchMessage } from "#shared/protocol";

import { Hub, MAX_LINES, OFFLINE_TTL_MS } from "./hub";

const info = (id = "a"): InstanceInfo => ({
  id,
  host: "desktop",
  repo: "jarrin/x",
  milestones: ["M1"],
  pid: 1,
  startedAt: 0,
});

const line = (text: string) => ({ t: 0, kind: "loop" as const, text });

function watched(hub: Hub): WatchMessage[] {
  const got: WatchMessage[] = [];
  hub.watch((m) => got.push(m));
  return got;
}

describe("Hub", () => {
  it("snapshots existing instances with their lines to a new watcher", () => {
    const hub = new Hub(() => 1);
    hub.hello(info());
    hub.log("a", [line("one")]);
    const [snap] = watched(hub);
    expect(snap).toMatchObject({
      type: "snapshot",
      instances: [{ id: "a", online: true, lines: [{ text: "one" }] }],
    });
  });

  it("streams hello, log, status and disconnect to watchers", () => {
    const hub = new Hub(() => 1);
    const got = watched(hub);
    hub.hello(info());
    hub.log("a", [line("x")]);
    hub.status("a", "finished");
    hub.disconnect("a");
    expect(got.map((m) => m.type)).toEqual([
      "snapshot",
      "instance",
      "log",
      "instance",
      "instance",
    ]);
    expect(got.at(-1)).toMatchObject({
      instance: { online: false, status: "finished" },
    });
  });

  it("keeps a reconnecting instance's lines", () => {
    const hub = new Hub(() => 1);
    hub.hello(info());
    hub.log("a", [line("before")]);
    hub.disconnect("a");
    hub.hello(info());
    const [snap] = watched(hub);
    expect(snap).toMatchObject({
      instances: [{ online: true, lines: [{ text: "before" }] }],
    });
  });

  it("caps the lines kept per instance", () => {
    const hub = new Hub(() => 1);
    hub.hello(info());
    hub.log(
      "a",
      Array.from({ length: MAX_LINES + 10 }, (_, i) => line(`${i}`)),
    );
    const [snap] = watched(hub);
    if (snap?.type !== "snapshot") throw new Error("no snapshot");
    expect(snap.instances[0]?.lines).toHaveLength(MAX_LINES);
    expect(snap.instances[0]?.lines[0]?.text).toBe("10");
  });

  it("dismisses only offline instances", () => {
    const hub = new Hub(() => 1);
    hub.hello(info());
    hub.dismiss("a");
    expect(watched(hub)[0]).toMatchObject({ instances: [{ id: "a" }] });
    hub.disconnect("a");
    hub.dismiss("a");
    expect(watched(hub)[0]).toMatchObject({ instances: [] });
  });

  it("forgets offline instances after the TTL", () => {
    let now = 0;
    const hub = new Hub(() => now);
    hub.hello(info());
    hub.disconnect("a");
    now = OFFLINE_TTL_MS + 1;
    expect(watched(hub)[0]).toMatchObject({ instances: [] });
  });

  it("ignores logs for unknown instances", () => {
    const hub = new Hub(() => 1);
    const got = watched(hub);
    hub.log("nope", [line("x")]);
    expect(got).toHaveLength(1);
  });
});
