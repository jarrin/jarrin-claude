import type { BumpKind } from "./version.js";
import { bump, INITIAL_VERSION, tagName } from "./version.js";

/**
 * The preconditions `claudjar release` enforces, as a pure function of the repo's
 * observed state.
 *
 * Kept separate from the command so every refusal is testable without a real
 * repository — and so the rules read as a list rather than as branches buried in
 * IO. The command's job is to *gather* this state and *apply* the plan.
 */

/** Everything the decision depends on, gathered by the caller. */
export interface ReleaseState {
  /** Branch checked out where release runs; null when detached / not a repo. */
  readonly branch: string | null;
  /** The repo's release branch — releases are refused anywhere else. */
  readonly releaseBranch: string;
  /** `git status --porcelain` lines; non-empty means a dirty tree. */
  readonly dirty: readonly string[];
  /** `project.dist.version`; "" when the project has never been released. */
  readonly currentVersion: string;
  /** Tags that already exist, to refuse re-releasing a version. */
  readonly existingTags: readonly string[];
}

export interface ReleasePlan {
  readonly from: string;
  readonly to: string;
  readonly tag: string;
  /** True when `project.dist.version` was absent and 0.0.0 was assumed. */
  readonly firstRelease: boolean;
}

export type Preflight =
  | { readonly ok: true; readonly plan: ReleasePlan }
  | { readonly ok: false; readonly error: string };

/**
 * Decide whether this repo may be released, and to which version.
 *
 * The branch and clean-tree checks come first and are absolute: a release
 * commits and tags whatever is in the tree, so releasing from a feature branch
 * or on top of uncommitted work produces a tag nobody can reproduce.
 */
export function preflight(state: ReleaseState, kind: BumpKind): Preflight {
  if (state.branch === null) {
    return {
      ok: false,
      error:
        "cannot determine the current branch (detached HEAD, or not a git repo).",
    };
  }
  if (state.branch !== state.releaseBranch) {
    return {
      ok: false,
      error:
        `releases run on '${state.releaseBranch}' only; you are on ` +
        `'${state.branch}'. Merge your work first, then release from ` +
        `'${state.releaseBranch}'.`,
    };
  }
  if (state.dirty.length > 0) {
    const shown = state.dirty.slice(0, 5).join("\n  ");
    const more =
      state.dirty.length > 5
        ? `\n  …and ${String(state.dirty.length - 5)} more`
        : "";
    return {
      ok: false,
      error: `the working tree is dirty; commit or stash first:\n  ${shown}${more}`,
    };
  }

  const firstRelease = state.currentVersion.trim() === "";
  const from = firstRelease ? INITIAL_VERSION : state.currentVersion.trim();
  const to = bump(from, kind);
  if (to === null) {
    return {
      ok: false,
      error:
        `project.dist.version is '${state.currentVersion}', which is not a ` +
        `plain major.minor.patch version. Fix it in .claude/.jarrin.yml first.`,
    };
  }

  const tag = tagName(to);
  if (state.existingTags.includes(tag)) {
    return {
      ok: false,
      error:
        `tag ${tag} already exists. Bump a different segment (--bump minor), ` +
        `or delete the tag if it was a mistake.`,
    };
  }

  return { ok: true, plan: { from, to, tag, firstRelease } };
}
