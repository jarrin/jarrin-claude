/**
 * Wire protocol between `claudjar loop` instances (agents), this server, and the
 * browser UI (watchers). Plain types only: the claudjar CLI imports this file
 * directly, so it must not pull in any dependency. The server validates what
 * agents and watchers send against the zod mirror in `server/utils/schema.ts`.
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

export type ControlAction = "pause" | "resume";

/** Where a live log comes from: a plain Claude Code session's hook, or a loop. */
export interface LiveLogSource {
  readonly kind: "session" | "loop";
  readonly host: string;
  /** The session's working directory, or the loop's repo. */
  readonly where: string;
  /** The Claude session id, or the loop instance id. */
  readonly session: string;
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

/** Server → watcher. Boards and questions are keyed by repo + milestone, not instance. */
export type WatchMessage =
  | {
      readonly type: "snapshot";
      readonly instances: readonly InstanceView[];
      readonly boards: readonly Board[];
      readonly questions: readonly Question[];
      readonly live: readonly LiveLog[];
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
  | { readonly type: "live-removed"; readonly id: string };

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
  | { readonly type: "dismiss-live"; readonly id: string };

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

export const AGENT_PATH = "/ws/agent";
export const WATCH_PATH = "/ws/watch";
export const LIVE_PATH = "/api/live";
