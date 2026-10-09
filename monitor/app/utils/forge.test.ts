import { describe, expect, it } from "vitest";
import { issueUrl, milestoneUrl, noForge, refSegments } from "./forge";

const forge = {
  url: "https://git.example.com",
  repo: "jarrin/prdl-new",
  milestones: [
    { id: 36, title: "Stash offload" },
    { id: 37, title: "Stash" },
  ],
};

describe("issueUrl / milestoneUrl", () => {
  it("links into the loop's repo by default", () => {
    expect(issueUrl(forge, 265)).toBe(
      "https://git.example.com/jarrin/prdl-new/issues/265",
    );
    expect(milestoneUrl(forge, 36)).toBe(
      "https://git.example.com/jarrin/prdl-new/milestone/36",
    );
  });
  it("links into another repo when given one", () => {
    expect(issueUrl(forge, 1, "a/b")).toBe(
      "https://git.example.com/a/b/issues/1",
    );
  });
  it("is undefined without a forge URL", () => {
    expect(issueUrl({ ...noForge, repo: "a/b" }, 1)).toBeUndefined();
  });
});

describe("refSegments", () => {
  it("splits out issue numbers and milestone titles", () => {
    expect(
      refSegments("=== #265 Move work  [Stash offload]", forge.milestones),
    ).toEqual([
      { kind: "text", text: "=== " },
      { kind: "issue", text: "#265", issue: 265 },
      { kind: "text", text: " Move work  [" },
      { kind: "milestone", text: "Stash offload", milestone: 36 },
      { kind: "text", text: "]" },
    ]);
  });
  it("ignores a # inside a word or an HTML entity", () => {
    expect(refSegments("color#12 &#39;")).toEqual([
      { kind: "text", text: "color#12 &#39;" },
    ]);
  });
  it("keeps plain text as one segment", () => {
    expect(refSegments("--- resumed")).toEqual([
      { kind: "text", text: "--- resumed" },
    ]);
  });
});
