import { describe, expect, it } from "vitest";
import { parseIssue, parseIssues, parseMessage, parseMilestone } from "./gitea";

const milestone = {
  id: 36,
  title: "Stash offload",
  description: "Move Stash's CPU-heavy generation",
  state: "open",
  open_issues: 2,
  closed_issues: 3,
  due_on: null,
};

describe("gitea results", () => {
  it("parses a milestone", () => {
    expect(parseMilestone(JSON.stringify(milestone))).toEqual(milestone);
  });
  it("rejects what is not a milestone", () => {
    expect(parseMilestone('{"id":1}')).toBeUndefined();
    expect(parseMilestone("not json")).toBeUndefined();
  });
  it("parses an issue, ignoring unknown fields", () => {
    const issue = parseIssue(
      JSON.stringify({
        id: 9,
        number: 265,
        title: "Move work",
        state: "open",
        html_url: "x",
        milestone: { id: 36, title: "Stash offload" },
      }),
    );
    expect(issue?.number).toBe(265);
    expect(issue?.milestone?.id).toBe(36);
  });
  it("counts the items the loop clipped off a list", () => {
    const list = parseIssues(
      JSON.stringify([
        { number: 1, title: "a", state: "open" },
        "… 7 more items",
      ]),
    );
    expect(list).toEqual({
      items: [{ number: 1, title: "a", state: "open" }],
      more: 7,
    });
  });
  it("rejects a list with foreign items", () => {
    expect(parseIssues('[{"number":1}]')).toBeUndefined();
  });
  it("unquotes a plain message", () => {
    expect(parseMessage('"Milestone deleted successfully"')).toBe(
      "Milestone deleted successfully",
    );
    expect(parseMessage("{}")).toBeUndefined();
  });
});
