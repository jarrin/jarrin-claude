import { describe, expect, it } from "vitest";

import { formatStatusline } from "./statusline.js";

/** Strip ANSI SGR codes so assertions read the visible text only. */
// eslint-disable-next-line no-control-regex
const strip = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("formatStatusline", () => {
  it("renders model · dir · branch in the main checkout (no worktree segment)", () => {
    const line = formatStatusline({
      modelName: "opus",
      dirName: "jarrin-claude",
      branch: "main",
      worktreeName: "",
      port: 0,
      up: null,
    });
    expect(strip(line)).toBe("opus · jarrin-claude · main");
    expect(line).not.toContain("⑂");
  });

  it("marks a live stack with a filled dot", () => {
    const line = formatStatusline({
      modelName: "opus",
      dirName: "jarrin-claude-feat",
      branch: "feat",
      worktreeName: "feature-x",
      port: 8001,
      up: true,
    });
    expect(strip(line)).toBe(
      "opus · jarrin-claude-feat · feat  ⑂ feature-x ●8001",
    );
  });

  it("marks an assigned-but-unserved port with a hollow dot", () => {
    const line = formatStatusline({
      modelName: "opus",
      dirName: "jarrin-claude-feat",
      branch: "feat",
      worktreeName: "feature-x",
      port: 8001,
      up: false,
    });
    expect(strip(line)).toBe(
      "opus · jarrin-claude-feat · feat  ⑂ feature-x ○8001",
    );
  });

  it("treats an unprobed port as down rather than claiming it is up", () => {
    const line = formatStatusline({
      modelName: "opus",
      dirName: "repo",
      branch: "wip",
      worktreeName: "feature-x",
      port: 8001,
      up: null,
    });
    expect(strip(line)).toContain("○8001");
    expect(strip(line)).not.toContain("●");
  });

  it("shows the worktree name without a port when none is assigned", () => {
    const line = formatStatusline({
      modelName: "opus",
      dirName: "repo",
      branch: "wip",
      worktreeName: "feature-x",
      port: 0,
      up: null,
    });
    expect(strip(line)).toBe("opus · repo · wip  ⑂ feature-x");
  });

  it("omits the branch segment on a detached HEAD / non-repo dir", () => {
    const line = formatStatusline({
      modelName: "claude",
      dirName: "loose",
      branch: null,
      worktreeName: "",
      port: 0,
      up: null,
    });
    expect(strip(line)).toBe("claude · loose");
  });
});
