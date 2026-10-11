/**
 * Wire protocol between `claudjar loop` instances (agents), `claudjar service`
 * instances (hosts), this server, and the browser UI (watchers). Plain types
 * only: the claudjar CLI imports this file directly, so it must not pull in any
 * dependency. The server validates what agents, hosts and watchers send against
 * the zod mirror in `server/utils/schema.ts`.
 *
 * The server is the loop's durable store: each milestone's progress (the issues
 * and their sessions' steps) and the open questions live here, persisted, so a
 * restarted loop picks up where the last one stopped and a question can be
 * answered while no loop is running.
 */

/** How a log line is coloured. */
export type LogKind =
  | "loop" // the loop's own progress lines
  | "input" // input the user sent to the loop
  | "text" // assistant text
  | "thinking" // assistant thinking
  | "tool" // a tool call
  | "output" // a tool result
  | "error" // a failed tool result or failed run
  | "result" // the end-of-session summary
  | "system" // session init and other harness events
  | "tail"; // new content of a file a running Bash call writes its output to

export interface LogLine {
  /** Epoch milliseconds. */
  readonly t: number;
  readonly kind: LogKind;
  readonly text: string;
  /** The issue the session was working, when the line came from one. */
  readonly issue?: number;
  /** The tool_use id pairing a `tool` line with its `output` / `error` line. */
  readonly call?: string;
  /** Structured detail behind a tool line, rendered richer than `text`. */
  readonly detail?: LogDetail;
}

/** One unified-diff hunk, as Claude Code reports it in `structuredPatch`. */
export interface PatchHunk {
  readonly oldStart: number;
  readonly newStart: number;
  /** Each line prefixed with " ", "-" or "+". */
  readonly lines: readonly string[];
}

export type LogDetail =
  /** A Bash call's full command. */
  | { readonly type: "command"; readonly command: string }
  /** Any other tool's input, as (size-capped) JSON text. */
  | { readonly type: "input"; readonly json: string }
  /** What an Edit or Write did to a file; a new file is one all-"+" hunk. */
  | {
      readonly type: "patch";
      readonly file: string;
      readonly hunks: readonly PatchHunk[];
      /** Patch lines dropped to keep the message small. */
      readonly omitted: number;
    }
  /**
   * A `tail` line: the file a Bash call redirects its output to, followed live
   * while the command runs. `done` marks the last line of the tail.
   */
  | { readonly type: "tail"; readonly file: string; readonly done: boolean };

export interface MilestoneRef {
  readonly id: number;
  readonly title: string;
}

export type EntryStatus = "open" | "working" | "waiting" | "blocked" | "closed";

export interface Step {
  readonly text: string;
  readonly done: boolean;
}

/** One milestone issue as the loop tracks it. */
export interface Entry {
  readonly number: number;
  readonly title: string;
  readonly status: EntryStatus;
  /** The session's own steps, from its latest `<<<STEPS` block. */
  readonly steps: readonly Step[];
  /** The session that worked it last; what a restart or an answer resumes. */
  readonly sessionId: string | null;
  /** While waiting: the open question's id. */
  readonly questionId: string | null;
  readonly stashed: boolean;
}

/** A milestone's progress: every issue the loop has seen in it, in work order. */
export interface Board {
  readonly repo: string;
  readonly milestone: MilestoneRef;
  readonly entries: readonly Entry[];
  readonly updatedAt: number;
}

/** A question a session ended on; open until the loop resumes it with the answer. */
export interface Question {
  /** Chosen by the agent, so a re-sent ask is recognised. */
  readonly id: string;
  readonly repo: string;
  readonly milestone: MilestoneRef;
  readonly issue: number;
  readonly title: string;
  readonly text: string;
  readonly askedAt: number;
  readonly answer: string | null;
  readonly answeredAt: number | null;
}

/** Who a loop instance is; sent once per connection, stable across reconnects. */
export interface InstanceInfo {
  /** Random per loop process — a reconnect keeps the same tab. */
  readonly id: string;
  readonly host: string;
  readonly repo: string;
  /** The forge's web root (e.g. `https://gitea.example.com`), for issue links. */
  readonly forge?: string;
  readonly milestones: readonly MilestoneRef[];
  readonly pid: number;
  readonly startedAt: number;
}

/**
 * What a watcher can tell a loop: `pause` / `resume` hold and release it
 * between sessions; `stop` aborts it — the running session ends, its work is
 * stashed, and the loop exits with status {@link ABORTED_STATUS}.
 */
export type ControlAction = "pause" | "resume" | "stop";

/** The status an aborted loop reports last. */
export const ABORTED_STATUS = "aborted";

/** Where a live log comes from: a plain Claude Code session's hook, or a loop. */
export interface LiveLogSource {
  readonly kind: "session" | "loop";
  readonly host: string;
  /** The session's working directory, or the loop's repo. */
  readonly where: string;
  /** The Claude session id, or the loop instance id. */
  readonly session: string;
  /** A loop's milestone: the one the call's issue is in, else all it works. */
  readonly milestone?: string;
}

/**
 * A file a Bash call writes its output to (`cmd > file`, `| tee file`),
 * followed live while the command runs. Keyed by the call's tool_use id.
 */
export interface LiveLogInfo {
  readonly id: string;
  readonly file: string;
  readonly command: string;
  readonly source: LiveLogSource;
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly done: boolean;
}

export interface LiveLog extends LiveLogInfo {
  /** The file's content since the call started; only its end is kept. */
  readonly text: string;
}

/**
 * Hook follower → server, POSTed as JSON to {@link LIVE_PATH}: the next chunk of
 * one live log. The first post for an id creates it; `done` ends it.
 */
export interface LivePost {
  readonly token?: string;
  readonly id: string;
  readonly file: string;
  readonly command: string;
  readonly source: LiveLogSource;
  readonly startedAt: number;
  readonly chunk: string;
  readonly done: boolean;
}

/** Agent → server. */
export type AgentMessage =
  | {
      readonly type: "hello";
      readonly instance: InstanceInfo;
      readonly token?: string;
    }
  | { readonly type: "log"; readonly lines: readonly LogLine[] }
  | {
      readonly type: "status";
      readonly status: string;
      readonly paused: boolean;
    }
  | {
      readonly type: "progress";
      readonly milestone: MilestoneRef;
      readonly entries: readonly Entry[];
    }
  | {
      readonly type: "ask";
      readonly question: Omit<
        Question,
        "repo" | "askedAt" | "answer" | "answeredAt"
      >;
    }
  /** The loop resumed the session with the answer: the question is closed. */
  | { readonly type: "resolved"; readonly questionId: string };

/** Server → agent. */
export type ServerMessage =
  /** Reply to `hello`: the stored state of the instance's milestones. */
  | {
      readonly type: "welcome";
      readonly boards: readonly Board[];
      readonly questions: readonly Question[];
    }
  | {
      readonly type: "answer";
      readonly questionId: string;
      readonly text: string;
    }
  | { readonly type: "control"; readonly action: ControlAction }
  | { readonly type: "input"; readonly text: string };

export interface InstanceSummary extends InstanceInfo {
  readonly online: boolean;
  readonly status: string;
  readonly paused: boolean;
  readonly lastSeen: number;
}

export interface InstanceView extends InstanceSummary {
  readonly lines: readonly LogLine[];
}

/**
 * A machine running `claudjar service`: it dials {@link HOST_PATH}, publishes the
 * projects it discovered, and runs the commands watchers send it. Keyed by
 * hostname, so a restarted service lands on the same entry.
 */
export interface HostInfo {
  readonly host: string;
  readonly pid: number;
  readonly startedAt: number;
}

/** One project a host offers: a direct child of its `projects_dir`. */
export interface ProjectInfo {
  readonly name: string;
  readonly path: string;
  /** Has `.claude/.jarrin.yml`. */
  readonly configured: boolean;
  /** Its backlog repo (`owner/name`), empty when none is configured. */
  readonly backlogRepo: string;
  /** Open in the web interface. */
  readonly active: boolean;
}

/** One open milestone of a project's backlog repo, with its issue counts. */
export interface MilestoneDetail {
  readonly id: number;
  readonly title: string;
  readonly openIssues: number;
  readonly closedIssues: number;
}

/** Whether a background session the service launched runs in a checkout. */
export type SessionStatus = "running" | "stopped" | "none";

/** One checkout of a project: its main checkout or a linked worktree. */
export interface WorktreeDetail {
  /** The stamped `worktree.name`; empty for the main checkout. */
  readonly name: string;
  /** The checked-out branch; empty when detached. */
  readonly branch: string;
  readonly path: string;
  /** The stamped `worktree.port`; 0 when none. */
  readonly port: number;
  /** The stamped `worktree.milestone` title; empty when not linked to one. */
  readonly milestone: string;
  readonly session: SessionStatus;
  /**
   * The pid of the `claudjar loop` the service started in this worktree, while
   * it runs; 0 when none. It pins the worktree to that loop's monitor instance.
   */
  readonly loopPid: number;
}

/**
 * What a project tab shows, collected by the host on open and on demand
 * (`refresh-project`): its backlog repo's open milestones and its worktrees.
 */
export interface ProjectDetail {
  readonly project: string;
  /** The backlog repo (`owner/name`); empty when none is configured. */
  readonly repo: string;
  /** The forge's web root, for milestone links; empty when unknown. */
  readonly forge: string;
  readonly milestones: readonly MilestoneDetail[];
  readonly worktrees: readonly WorktreeDetail[];
  /** Why the milestones could not be read; empty when they were. */
  readonly error: string;
  /** Epoch milliseconds. */
  readonly collectedAt: number;
}

/** A project's detail as watchers see it: which host it came from. */
export interface ProjectDetailView extends ProjectDetail {
  readonly host: string;
}

/** What a watcher can ask a host to do. */
export type HostCommand =
  | { readonly type: "open-project"; readonly project: string }
  | { readonly type: "close-project"; readonly project: string }
  /** Collect the project's detail again and publish it. */
  | { readonly type: "refresh-project"; readonly project: string }
  /**
   * Create a worktree of an open project and start something in it: a
   * `claudjar loop` working `milestone` (`mode: "loop"`, which needs one), or a
   * plain background Claude session (`mode: "session"`). `name` defaults to one
   * derived from the milestone title; one of the two must be given.
   */
  | {
      readonly type: "create-worktree";
      readonly project: string;
      readonly name?: string;
      readonly milestone?: MilestoneRef;
      readonly mode: WorktreeMode;
    }
  /** Abort the loop the service started in a worktree (SIGTERM to its pid). */
  | {
      readonly type: "stop-loop";
      readonly project: string;
      readonly worktree: string;
    }
  /** Start `claudjar loop` again in a worktree, on its linked milestone. */
  | {
      readonly type: "resume-loop";
      readonly project: string;
      readonly worktree: string;
    }
  /**
   * Merge a worktree's branch into the checkout it was created from; with
   * `remove`, then tear it down as `remove-worktree` does. Refused while a loop
   * or session runs in it or either tree is dirty; a conflict is aborted.
   */
  | {
      readonly type: "merge-worktree";
      readonly project: string;
      readonly worktree: string;
      readonly remove: boolean;
    }
  /**
   * Stop the worktree's session and loop, run its stack teardown and remove
   * hooks, remove it, and forget it. An unmerged branch is kept.
   */
  | {
      readonly type: "remove-worktree";
      readonly project: string;
      readonly worktree: string;
    };

/** What `create-worktree` starts in the new worktree. */
export type WorktreeMode = "loop" | "session";

/**
 * The worktree name `create-worktree` derives from a milestone title: lower
 * case, runs of anything but letters, digits, `_` and `-` folded to one `-`,
 * trimmed of leading / trailing `-`, at most 48 characters. Empty when nothing
 * usable is left.
 */
export function worktreeNameFor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/^[-_]+|[-_]+$/g, "");
}

/** How long the server waits for a host to answer a command. */
export function commandTimeoutMs(command: HostCommand): number {
  // Creating, merging and removing a worktree run its setup, hooks and stack
  // teardown (`pnpm install`, image builds, `docker compose down`).
  switch (command.type) {
    case "create-worktree":
    case "merge-worktree":
    case "remove-worktree":
      return 15 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

/** A host's answer to one command, keyed by the id the watcher chose. */
export interface CommandResult {
  readonly id: string;
  readonly ok: boolean;
  /** Why it failed; empty on success. */
  readonly error: string;
}

/** Host → server. The first message must be `host-hello`, carrying the agent token. */
export type HostMessage =
  | {
      readonly type: "host-hello";
      readonly host: HostInfo;
      readonly token?: string;
      readonly projects: readonly ProjectInfo[];
    }
  /** The whole project list, after a rescan changed it. */
  | { readonly type: "projects"; readonly projects: readonly ProjectInfo[] }
  /** One project changed (opened, closed). */
  | { readonly type: "project-state"; readonly project: ProjectInfo }
  /** A project's freshly collected detail. */
  | { readonly type: "project-detail"; readonly detail: ProjectDetail }
  | { readonly type: "command-result"; readonly result: CommandResult };

/**
 * A forge webhook the monitor received (`/api/webhook/gitea`), relayed to the
 * hosts with a project whose backlog repo it names. Deliberately thin: the host
 * re-reads the forge itself, so the event only says *something changed*.
 */
export interface ForgeEvent {
  /** `owner/name`. */
  readonly repo: string;
  /** The forge's event name (`X-Gitea-Event`): `issues`, `issue_comment`, … */
  readonly event: string;
  /** The payload's `action` (`opened`, `milestoned`, …); empty when it has none. */
  readonly action: string;
}

/** Server → host. */
export type ServerHostMessage =
  | { readonly type: "host-welcome" }
  | {
      readonly type: "command";
      readonly id: string;
      readonly command: HostCommand;
    }
  | { readonly type: "forge-event"; readonly event: ForgeEvent };

/** A host as watchers see it; an offline host keeps its last project list. */
export interface HostView extends HostInfo {
  readonly online: boolean;
  readonly lastSeen: number;
  readonly projects: readonly ProjectInfo[];
}

/** A command's outcome as watchers see it: which host ran what. */
export interface CommandOutcome extends CommandResult {
  readonly host: string;
  readonly command: HostCommand;
  readonly at: number;
}

/** Server → watcher. Boards and questions are keyed by repo + milestone, not instance. */
export type WatchMessage =
  | {
      readonly type: "snapshot";
      readonly instances: readonly InstanceView[];
      readonly boards: readonly Board[];
      readonly questions: readonly Question[];
      readonly live: readonly LiveLog[];
      readonly hosts: readonly HostView[];
      readonly details: readonly ProjectDetailView[];
    }
  | { readonly type: "instance"; readonly instance: InstanceSummary }
  | {
      readonly type: "log";
      readonly id: string;
      readonly lines: readonly LogLine[];
    }
  | { readonly type: "removed"; readonly id: string }
  | { readonly type: "board"; readonly board: Board }
  | { readonly type: "question"; readonly question: Question }
  | { readonly type: "question-closed"; readonly id: string }
  /** New content of a live log (created on first sight); `chunk` is appended. */
  | { readonly type: "live"; readonly log: LiveLogInfo; readonly chunk: string }
  | { readonly type: "live-removed"; readonly id: string }
  | { readonly type: "host"; readonly host: HostView }
  | { readonly type: "project-detail"; readonly detail: ProjectDetailView }
  | {
      readonly type: "project-detail-removed";
      readonly host: string;
      readonly project: string;
    }
  | { readonly type: "command-result"; readonly result: CommandOutcome };

/** Watcher → server. */
export type WatcherMessage =
  | { readonly type: "dismiss"; readonly id: string }
  | {
      readonly type: "answer";
      readonly questionId: string;
      readonly text: string;
    }
  | {
      readonly type: "control";
      readonly id: string;
      readonly action: ControlAction;
    }
  | { readonly type: "input"; readonly id: string; readonly text: string }
  | { readonly type: "dismiss-live"; readonly id: string }
  /** Run `command` on `host`; `id` comes back on the matching `command-result`. */
  | {
      readonly type: "command";
      readonly id: string;
      readonly host: string;
      readonly command: HostCommand;
    };

/** The key boards are stored under: one per repo + milestone. */
export function boardKey(repo: string, milestoneId: number): string {
  return `${repo}#${String(milestoneId)}`;
}

/** Whether `instance` works the milestone a board or question belongs to. */
export function covers(
  instance: Pick<InstanceInfo, "repo" | "milestones">,
  item: { readonly repo: string; readonly milestone: MilestoneRef },
): boolean {
  return (
    instance.repo === item.repo &&
    instance.milestones.some((m) => m.id === item.milestone.id)
  );
}

/** Tab label: the milestone name(s) plus the host the loop runs on. */
export function instanceLabel(info: InstanceInfo): string {
  const what = info.milestones.length
    ? info.milestones.map((m) => m.title).join(", ")
    : info.repo;
  return `${what} @ ${info.host}`;
}

/** The key project details are stored under: one per host + project. */
export function detailKey(host: string, project: string): string {
  return `${host}/${project}`;
}

/**
 * The loop instances working a worktree. The loop the service started there is
 * matched by its pid on the same host; failing that (a loop started by hand, or
 * not connected yet), any loop on the same host and backlog repo with the
 * worktree's linked milestone among its milestones.
 */
export function loopsFor<
  T extends Pick<InstanceInfo, "host" | "repo" | "milestones" | "pid">,
>(
  instances: readonly T[],
  host: string,
  repo: string,
  worktree: Pick<WorktreeDetail, "milestone" | "loopPid">,
): T[] {
  if (worktree.loopPid > 0) {
    const pinned = instances.filter(
      (i) => i.host === host && i.pid === worktree.loopPid,
    );
    if (pinned.length > 0) return pinned;
  }
  if (!worktree.milestone || !repo) return [];
  return instances.filter(
    (i) =>
      i.host === host &&
      i.repo === repo &&
      i.milestones.some((m) => m.title === worktree.milestone),
  );
}

export const AGENT_PATH = "/ws/agent";
export const WATCH_PATH = "/ws/watch";
export const HOST_PATH = "/ws/host";
export const LIVE_PATH = "/api/live";
export const WEBHOOK_PATH = "/api/webhook/gitea";
