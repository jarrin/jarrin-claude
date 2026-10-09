import { describe, expect, it } from "vitest";

import type {
  Board,
  InstanceSummary,
  InstanceView,
  Question,
} from "#shared/protocol";
import { instanceLabel } from "#shared/protocol";

import {
  MAX_VIEW_LINES,
  applyWatchMessage,
  boardsOf,
  emptyState,
  noticesFor,
  questionsOf,
} from "./instances";
import type { MonitorState } from "./instances";

const S2 = { id: 2, title: "Stage 2" };
const S3 = { id: 3, title: "Stage 3" };

const summary: InstanceSummary = {
  id: "a",
  host: "desktop",
  repo: "o/r",
  milestones: [S2, S3],
  pid: 1,
  startedAt: 0,
  online: true,
  status: "running",
  paused: false,
  lastSeen: 0,
};
const view: InstanceView = { ...summary, lines: [] };
const withView: MonitorState = { ...emptyState, instances: [view] };

const board = (status: Board["entries"][number]["status"]): Board => ({
  repo: "o/r",
  milestone: S3,
  entries: [
    {
      number: 5,
      title: "five",
      status,
      steps: [],
      sessionId: null,
      questionId: null,
      stashed: false,
    },
  ],
  updatedAt: 0,
});

const question: Question = {
  id: "q",
  repo: "o/r",
  milestone: S2,
  issue: 5,
  title: "five",
  text: "which?",
  askedAt: 1,
  answer: null,
  answeredAt: null,
};

describe("applyWatchMessage", () => {
  it("adds a new instance and updates an existing one in place", () => {
    const added = applyWatchMessage(emptyState, {
      type: "instance",
      instance: summary,
    });
    expect(added.instances).toHaveLength(1);
    const logged = applyWatchMessage(added, {
      type: "log",
      id: "a",
      lines: [{ t: 0, kind: "text", text: "hi" }],
    });
    const offline = applyWatchMessage(logged, {
      type: "instance",
      instance: { ...summary, online: false },
    });
    expect(offline.instances[0]).toMatchObject({
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
    const next = applyWatchMessage(withView, {
      type: "log",
      id: "a",
      lines: many,
    });
    expect(next.instances[0]?.lines).toHaveLength(MAX_VIEW_LINES);
  });

  it("removes a dismissed instance and replaces all on snapshot", () => {
    expect(
      applyWatchMessage(withView, { type: "removed", id: "a" }).instances,
    ).toEqual([]);
    expect(
      applyWatchMessage(emptyState, {
        type: "snapshot",
        instances: [view],
        boards: [board("open")],
        questions: [question],
      }),
    ).toEqual({
      instances: [view],
      boards: [board("open")],
      questions: [question],
    });
  });

  it("replaces a board by milestone and tracks questions until closed", () => {
    let s = applyWatchMessage(withView, {
      type: "board",
      board: board("open"),
    });
    s = applyWatchMessage(s, { type: "board", board: board("working") });
    expect(s.boards).toEqual([board("working")]);
    s = applyWatchMessage(s, { type: "question", question });
    s = applyWatchMessage(s, {
      type: "question",
      question: { ...question, answer: "b" },
    });
    expect(s.questions).toEqual([{ ...question, answer: "b" }]);
    s = applyWatchMessage(s, { type: "question-closed", id: "q" });
    expect(s.questions).toEqual([]);
  });

  it("selects an instance's boards in milestone order and its questions", () => {
    const s: MonitorState = {
      instances: [view],
      boards: [
        board("open"),
        { ...board("open"), milestone: S2 },
        { ...board("open"), repo: "x/y" },
      ],
      questions: [question, { ...question, id: "z", repo: "x/y" }],
    };
    expect(boardsOf(s, view).map((b) => b.milestone.id)).toEqual([2, 3]);
    expect(questionsOf(s, view).map((q) => q.id)).toEqual(["q"]);
  });
});

describe("noticesFor", () => {
  it("notifies a new question once, pointing at its instance", () => {
    const first = noticesFor(withView, { type: "question", question });
    expect(first).toEqual([
      expect.objectContaining({ tag: "question-q", instanceId: "a" }),
    ]);
    const known = { ...withView, questions: [question] };
    expect(
      noticesFor(known, {
        type: "question",
        question: { ...question, answer: "x" },
      }),
    ).toEqual([]);
  });

  it("notifies an issue turning blocked, and a loop that ends", () => {
    const s = { ...withView, boards: [board("working")] };
    expect(noticesFor(s, { type: "board", board: board("blocked") })).toEqual([
      expect.objectContaining({ title: "#5 is blocked — Stage 3" }),
    ]);
    expect(
      noticesFor(
        { ...s, boards: [board("blocked")] },
        { type: "board", board: board("blocked") },
      ),
    ).toEqual([]);
    expect(
      noticesFor(s, {
        type: "instance",
        instance: { ...summary, status: "finished: no open issues left" },
      }),
    ).toEqual([expect.objectContaining({ title: "Loop finished" })]);
  });

  it("never notifies from a snapshot", () => {
    expect(
      noticesFor(emptyState, {
        type: "snapshot",
        instances: [view],
        boards: [],
        questions: [question],
      }),
    ).toEqual([]);
  });
});

describe("instanceLabel", () => {
  it("names the tab by milestones and host", () => {
    expect(instanceLabel(summary)).toBe("Stage 2, Stage 3 @ desktop");
    expect(instanceLabel({ ...summary, milestones: [] })).toBe("o/r @ desktop");
  });
});
