import { describe, expect, it } from "vitest";

import {
  bump,
  bumpVersion,
  formatVersion,
  parseBumpKind,
  parseVersion,
  tagName,
} from "./version.js";

describe("parseVersion", () => {
  it("parses a plain major.minor.patch", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseVersion("  0.1.0 ")).toEqual({ major: 0, minor: 1, patch: 0 });
  });

  it("rejects pre-release and build metadata rather than mangling it", () => {
    expect(parseVersion("1.2.3-rc.1")).toBeNull();
    expect(parseVersion("1.2.3+build")).toBeNull();
  });

  it("rejects partial and non-numeric versions", () => {
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("v1.2.3")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });
});

describe("bumpVersion", () => {
  const v = { major: 1, minor: 4, patch: 7 };

  it("zeroes the less-significant segments on a major bump", () => {
    expect(formatVersion(bumpVersion(v, "major"))).toBe("2.0.0");
  });

  it("zeroes patch on a minor bump", () => {
    expect(formatVersion(bumpVersion(v, "minor"))).toBe("1.5.0");
  });

  it("increments only patch on a patch bump", () => {
    expect(formatVersion(bumpVersion(v, "patch"))).toBe("1.4.8");
  });
});

describe("bump", () => {
  it("defaults-case: 0.1.3 patches to 0.1.4", () => {
    expect(bump("0.1.3", "patch")).toBe("0.1.4");
  });

  it("returns null for an unparseable current version", () => {
    expect(bump("nightly", "patch")).toBeNull();
  });
});

describe("parseBumpKind", () => {
  it("accepts the three kinds, case-insensitively", () => {
    expect(parseBumpKind("Major")).toBe("major");
    expect(parseBumpKind("minor")).toBe("minor");
    expect(parseBumpKind(" patch ")).toBe("patch");
  });

  it("throws listing the allowed values", () => {
    expect(() => parseBumpKind("mayor")).toThrow(/major, minor, patch/);
  });
});

describe("tagName", () => {
  it("prefixes with v", () => {
    expect(tagName("1.0.0")).toBe("v1.0.0");
  });
});
