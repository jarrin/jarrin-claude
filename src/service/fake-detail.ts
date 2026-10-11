import type { MilestoneCounts } from "../loop/gitea.js";
import type { DetailDeps, StampedIdentity } from "./detail.js";

/**
 * {@link DetailDeps} over in-memory data, for tests: `worktrees` is each
 * project path's `git worktree list --porcelain`, `stamps` each worktree's
 * identity, `milestones` each repo's open milestones (a string is the error
 * the forge throws). With `forge: false`, no credentials resolve.
 */
export interface FakeDetail {
  readonly worktrees?: Readonly<Record<string, string>>;
  readonly stamps?: Readonly<Record<string, StampedIdentity>>;
  readonly milestones?: Readonly<Record<string, MilestoneCounts[] | string>>;
  readonly forge?: boolean;
  readonly now?: number;
}

const UNSTAMPED: StampedIdentity = { name: "", port: 0, milestone: "" };

export function fakeDetailDeps(fake: FakeDetail = {}): DetailDeps {
  return {
    worktreeList: (path) => fake.worktrees?.[path] ?? null,
    identity: (path) => fake.stamps?.[path] ?? UNSTAMPED,
    forge:
      fake.forge === false
        ? null
        : (repo) => ({
            openMilestones: () => {
              const m = fake.milestones?.[repo] ?? [];
              return typeof m === "string"
                ? Promise.reject(new Error(m))
                : Promise.resolve([...m]);
            },
          }),
    forgeUrl: "https://git.example",
    now: () => fake.now ?? 0,
  };
}
