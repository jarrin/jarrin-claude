import { describe, expect, it } from "vitest";

import type { InstanceSummary, InstanceView } from "#shared/protocol";
import { instanceLabel } from "#shared/protocol";

import { MAX_VIEW_LINES, applyWatchMessage } from "./instances";

const summary: InstanceSummary = {
  id: "a",
  host: "desktop",
  repo: "o/r",
  milestones: ["Stage 2", "Stage 3"],
  pid: 1,
  startedAt: 0,
  online: true,
  status: "running",
  lastSeen: 0,
};
const view: InstanceView = { ...summary, lines: [] };

describe("applyWatchMessage", () => {
  it("adds a new instance and updates an existing one in place", () => {
    const added = applyWatchMessage([], {
      type: "instance",
      instance: summary,
    });
    expect(added).toHaveLength(1);
    const logged = applyWatchMessage(added, {
      type: "log",
      id: "a",
      lines: [{ t: 0, kind: "text", text: "hi" }],
    });
    const offline = applyWatchMessage(logged, {
      type: "instance",
      instance: { ...summary, online: false },
    });
    expect(offline[0]).toMatchObject({
      online: false,
      lines: [{ text: "hi" }],
    });
  });

  it("bounds the lines kept per tab", () => {
    const many = Array.from({ length: MAX_VIEW_LINES + 5 }, (_, i) => ({
      t: i,
      kind: "loop" as const,
      text: String(i),
    }));
    const [one] = applyWatchMessage([view], {
      type: "log",
      id: "a",
      lines: many,
    });
    expect(one?.lines).toHaveLength(MAX_VIEW_LINES);
  });

  it("removes a dismissed instance and replaces all on snapshot", () => {
    expect(applyWatchMessage([view], { type: "removed", id: "a" })).toEqual([]);
    expect(
      applyWatchMessage([], { type: "snapshot", instances: [view] }),
    ).toEqual([view]);
  });
});

describe("instanceLabel", () => {
  it("names the tab by milestones and host", () => {
    expect(instanceLabel(summary)).toBe("Stage 2, Stage 3 @ desktop");
    expect(instanceLabel({ ...summary, milestones: [] })).toBe("o/r @ desktop");
  });
});
