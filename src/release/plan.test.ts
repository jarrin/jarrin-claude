import { describe, expect, it } from "vitest";

import type { ReleaseState } from "./plan.js";
import { preflight } from "./plan.js";

const clean: ReleaseState = {
  branch: "main",
  releaseBranch: "main",
  dirty: [],
  currentVersion: "0.1.3",
  existingTags: ["v0.1.0", "v0.1.3"],
};

function expectError(state: Partial<ReleaseState>): string {
  const r = preflight({ ...clean, ...state }, "patch");
  expect(r.ok).toBe(false);
  return r.ok ? "" : r.error;
}

describe("preflight", () => {
  it("plans the default patch bump", () => {
    const r = preflight(clean, "patch");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan).toEqual({
        from: "0.1.3",
        to: "0.1.4",
        tag: "v0.1.4",
        firstRelease: false,
      });
    }
  });

  it("plans minor and major bumps", () => {
    const minor = preflight(clean, "minor");
    expect(minor.ok && minor.plan.to).toBe("0.2.0");
    const major = preflight(clean, "major");
    expect(major.ok && major.plan.to).toBe("1.0.0");
  });

  it("treats a missing version as 0.0.0, so the first patch is 0.0.1", () => {
    const r = preflight({ ...clean, currentVersion: "" }, "patch");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.from).toBe("0.0.0");
      expect(r.plan.to).toBe("0.0.1");
      expect(r.plan.firstRelease).toBe(true);
    }
  });

  it("refuses a branch other than the release branch", () => {
    expect(expectError({ branch: "feature/x" })).toContain(
      "releases run on 'main' only",
    );
  });

  it("honours a non-default release branch", () => {
    const r = preflight(
      { ...clean, branch: "master", releaseBranch: "master" },
      "patch",
    );
    expect(r.ok).toBe(true);
  });

  it("refuses a detached HEAD", () => {
    expect(expectError({ branch: null })).toContain("detached HEAD");
  });

  it("refuses a dirty tree and names the files", () => {
    const error = expectError({ dirty: [" M src/cli.ts", "?? scratch.txt"] });
    expect(error).toContain("working tree is dirty");
    expect(error).toContain("src/cli.ts");
  });

  it("truncates a long dirty list", () => {
    const dirty = Array.from({ length: 9 }, (_, i) => ` M file${String(i)}.ts`);
    expect(expectError({ dirty })).toContain("…and 4 more");
  });

  it("refuses an unparseable current version", () => {
    expect(expectError({ currentVersion: "2024.1" })).toContain(
      "not a plain major.minor.patch",
    );
  });

  it("refuses to re-release an existing tag", () => {
    const error = expectError({
      currentVersion: "0.1.3",
      existingTags: ["v0.1.4"],
    });
    expect(error).toContain("tag v0.1.4 already exists");
  });
});
