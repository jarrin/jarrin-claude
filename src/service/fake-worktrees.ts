import type {
  CreateOptions,
  CreateResult,
  MergeOptions,
  MergeResult,
  RemoveOptions,
  RemoveResult,
} from "../worktree/lib.js";
import type { ManageDeps } from "./manage.js";
import type { CreateDeps, LoopSpec } from "./worktrees.js";

/**
 * {@link CreateDeps} (less the session and liveness parts) over in-memory
 * data, for tests. `create` succeeds with `<repoRoot>-worktrees/<name>` unless
 * `createError` is set; `holders` maps `<repo>#<milestone id>` to the pid of a
 * loop already holding that milestone's lock; `startLoop` hands out `pid`, or
 * rejects with `loopError`. Every call is recorded.
 *
 * For the worktree commands: `dirty` maps a checkout path to its uncommitted
 * changes; `lockHolders` maps a worktree path to a loop holding its lock;
 * `merge` / `remove` answer `mergeResult` / `removeResult` (success by
 * default); `stopLoop` reports `stopsLoop` (true by default) and, when true,
 * calls `onStop` so a test can mark the pid dead.
 */
export interface FakeWorktrees {
  readonly createError?: string;
  /** With `createError`: the worktree was made before the failure. */
  readonly leftAt?: string;
  readonly holders?: Readonly<Record<string, number>>;
  readonly pid?: number;
  readonly loopError?: string;
  readonly dirty?: Readonly<Record<string, readonly string[]>>;
  readonly lockHolders?: Readonly<Record<string, number>>;
  readonly mergeResult?: MergeResult;
  readonly removeResult?: RemoveResult;
  readonly stopsLoop?: boolean;
  readonly onStop?: (pid: number) => void;
}

export interface FakeWorktreeDeps
  extends
    Omit<CreateDeps, "session" | "isAlive">,
    Pick<
      ManageDeps,
      "merge" | "remove" | "dirty" | "worktreeLoopHolder" | "stopLoop"
    > {
  readonly created: {
    readonly repoRoot: string;
    readonly opts: CreateOptions;
  }[];
  readonly loops: LoopSpec[];
  readonly merged: { readonly repoRoot: string; readonly opts: MergeOptions }[];
  readonly removed: {
    readonly repoRoot: string;
    readonly opts: RemoveOptions;
  }[];
  readonly stopped: number[];
}

export function fakeWorktreeDeps(fake: FakeWorktrees = {}): FakeWorktreeDeps {
  const created: FakeWorktreeDeps["created"] = [];
  const loops: LoopSpec[] = [];
  const merged: FakeWorktreeDeps["merged"] = [];
  const removed: FakeWorktreeDeps["removed"] = [];
  const stopped: number[] = [];
  return {
    created,
    loops,
    merged,
    removed,
    stopped,
    merge: (repoRoot, opts) => {
      merged.push({ repoRoot, opts });
      return Promise.resolve(
        fake.mergeResult ?? {
          ok: true,
          into: "main",
          removal: opts.remove
            ? { path: null, branchKept: false, hookError: null }
            : null,
        },
      );
    },
    remove: (repoRoot, opts) => {
      removed.push({ repoRoot, opts });
      return Promise.resolve(
        fake.removeResult ?? {
          ok: true,
          path: null,
          branchKept: false,
          hookError: null,
        },
      );
    },
    dirty: (path) => fake.dirty?.[path] ?? [],
    worktreeLoopHolder: (_repo, path) => fake.lockHolders?.[path] ?? null,
    stopLoop: (pid) => {
      stopped.push(pid);
      const ok = fake.stopsLoop ?? true;
      if (ok) fake.onStop?.(pid);
      return Promise.resolve(ok);
    },
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
