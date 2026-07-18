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
    });
    expect(strip(line)).toBe("opus · jarrin-claude · main");
    expect(line).not.toContain("⑂");
  });

  it("appends a worktree name + port segment when a worktree is stamped", () => {
    const line = formatStatusline({
      modelName: "opus",
      dirName: "jarrin-claude-feat",
      branch: "feat",
      worktreeName: "feature-x",
      port: 8001,
    });
    expect(strip(line)).toBe(
      "opus · jarrin-claude-feat · feat  ⑂ feature-x :8001",
    );
  });

  it("shows the worktree name without a port when none is assigned", () => {
    const line = formatStatusline({
      modelName: "opus",
      dirName: "repo",
      branch: "wip",
      worktreeName: "feature-x",
      port: 0,
    });
    expect(strip(line)).toBe("opus · repo · wip  ⑂ feature-x");
    expect(strip(line)).not.toContain(":");
  });

  it("omits the branch segment on a detached HEAD / non-repo dir", () => {
    const line = formatStatusline({
      modelName: "claude",
      dirName: "loose",
      branch: null,
      worktreeName: "",
      port: 0,
    });
    expect(strip(line)).toBe("claude · loose");
  });
});
