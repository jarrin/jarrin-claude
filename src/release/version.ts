/**
 * Semantic version arithmetic for `claudjar release`.
 *
 * Deliberately narrow: only the `major.minor.patch` core is modelled. Pre-release
 * and build metadata (`1.2.3-rc.1+build`) are rejected rather than silently
 * mangled — a release flow that guesses what to do with a `-rc` suffix is worse
 * than one that says it cannot.
 */

/** Which segment `release` increments. `patch` is the default. */
export type BumpKind = "major" | "minor" | "patch";

export const BUMP_KINDS: readonly BumpKind[] = ["major", "minor", "patch"];

export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** The version a never-released project starts from, so the first bump gives 0.0.1. */
export const INITIAL_VERSION = "0.0.0";

const CORE = /^(\d+)\.(\d+)\.(\d+)$/;

/** Parse `major.minor.patch`; null for anything else (incl. pre-release tags). */
export function parseVersion(text: string): Version | null {
  const m = CORE.exec(text.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function formatVersion(v: Version): string {
  return `${String(v.major)}.${String(v.minor)}.${String(v.patch)}`;
}

/** Increment `kind`, zeroing every less-significant segment. */
export function bumpVersion(v: Version, kind: BumpKind): Version {
  switch (kind) {
    case "major":
      return { major: v.major + 1, minor: 0, patch: 0 };
    case "minor":
      return { major: v.major, minor: v.minor + 1, patch: 0 };
    case "patch":
      return { major: v.major, minor: v.minor, patch: v.patch + 1 };
  }
}

/**
 * Bump a version string in one step. Returns null when `current` is not a plain
 * `major.minor.patch`, so the caller can report the offending value.
 */
export function bump(current: string, kind: BumpKind): string | null {
  const parsed = parseVersion(current);
  if (!parsed) return null;
  return formatVersion(bumpVersion(parsed, kind));
}

/** Parse a `--bump` flag value. Throws with the allowed set on a bad value. */
export function parseBumpKind(value: string): BumpKind {
  const v = value.trim().toLowerCase();
  if (v === "major" || v === "minor" || v === "patch") return v;
  throw new Error(`expected one of ${BUMP_KINDS.join(", ")}, got '${value}'`);
}

/** The git tag for a version. Annotated tags are created as `v<version>`. */
export function tagName(version: string): string {
  return `v${version}`;
}
