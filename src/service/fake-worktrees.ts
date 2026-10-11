import type { CreateOptions, CreateResult } from "../worktree/lib.js";
import type { CreateDeps, LoopSpec } from "./worktrees.js";

/**
 * {@link CreateDeps} (less the session and liveness parts) over in-memory
 * data, for tests. `create` succeeds with `<repoRoot>-worktrees/<name>` unless
 * `createError` is set; `holders` maps `<repo>#<milestone id>` to the pid of a
 * loop already holding that milestone's lock; `startLoop` hands out `pid`, or
 * rejects with `loopError`. Every call is recorded.
 */
export interface FakeWorktrees {
  readonly createError?: string;
  /** With `createError`: the worktree was made before the failure. */
  readonly leftAt?: string;
  readonly holders?: Readonly<Record<string, number>>;
  readonly pid?: number;
  readonly loopError?: string;
}

export interface FakeWorktreeDeps extends Omit<
  CreateDeps,
  "session" | "isAlive"
> {
  readonly created: {
    readonly repoRoot: string;
    readonly opts: CreateOptions;
  }[];
  readonly loops: LoopSpec[];
}

export function fakeWorktreeDeps(fake: FakeWorktrees = {}): FakeWorktreeDeps {
  const created: FakeWorktreeDeps["created"] = [];
  const loops: LoopSpec[] = [];
  return {
    created,
    loops,
    create: (repoRoot, opts): Promise<CreateResult> => {
      created.push({ repoRoot, opts });
      return Promise.resolve(
        fake.createError
          ? { ok: false, error: fake.createError, path: fake.leftAt ?? null }
          : {
              ok: true,
              name: opts.name,
              path: `${repoRoot}-worktrees/${opts.name}`,
              port: 0,
              milestone: opts.milestone ?? "",
            },
      );
    },
    loopHolder: (repo, id) => fake.holders?.[`${repo}#${String(id)}`] ?? null,
    startLoop: (spec) => {
      loops.push(spec);
      return fake.loopError
        ? Promise.reject(new Error(fake.loopError))
        : Promise.resolve({
            pid: fake.pid ?? 4242,
            log: `/logs/${spec.label}.log`,
          });
    },
  };
}
