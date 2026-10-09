/**
 * Wire protocol between `claudjar loop` instances (agents), this server, and the
 * browser UI (watchers). Plain types only: the claudjar CLI imports this file
 * directly, so it must not pull in any dependency. The server validates what
 * agents send against the zod mirror in `server/utils/schema.ts`.
 */

/** How a log line is coloured. */
export type LogKind =
  | "loop" // the loop's own progress lines
  | "text" // assistant text
  | "thinking" // assistant thinking
  | "tool" // a tool call
  | "output" // a tool result
  | "error" // a failed tool result or failed run
  | "result" // the end-of-session summary
  | "system"; // session init and other harness events

export interface LogLine {
  /** Epoch milliseconds. */
  readonly t: number;
  readonly kind: LogKind;
  readonly text: string;
  /** The issue the session was working, when the line came from one. */
  readonly issue?: number;
}

/** Who a loop instance is; sent once per connection, stable across reconnects. */
export interface InstanceInfo {
  /** Random per loop process — a reconnect keeps the same tab. */
  readonly id: string;
  readonly host: string;
  readonly repo: string;
  readonly milestones: readonly string[];
  readonly pid: number;
  readonly startedAt: number;
}

/** Agent → server. */
export type AgentMessage =
  | {
      readonly type: "hello";
      readonly instance: InstanceInfo;
      readonly token?: string;
    }
  | { readonly type: "log"; readonly lines: readonly LogLine[] }
  | { readonly type: "status"; readonly status: string };

export interface InstanceSummary extends InstanceInfo {
  readonly online: boolean;
  readonly status: string;
  readonly lastSeen: number;
}

export interface InstanceView extends InstanceSummary {
  readonly lines: readonly LogLine[];
}

/** Server → watcher. */
export type WatchMessage =
  | { readonly type: "snapshot"; readonly instances: readonly InstanceView[] }
  | { readonly type: "instance"; readonly instance: InstanceSummary }
  | {
      readonly type: "log";
      readonly id: string;
      readonly lines: readonly LogLine[];
    }
  | { readonly type: "removed"; readonly id: string };

/** Watcher → server. */
export type WatcherMessage = { readonly type: "dismiss"; readonly id: string };

/** Tab label: the milestone name(s) plus the host the loop runs on. */
export function instanceLabel(info: InstanceInfo): string {
  const what = info.milestones.length ? info.milestones.join(", ") : info.repo;
  return `${what} @ ${info.host}`;
}

export const AGENT_PATH = "/ws/agent";
export const WATCH_PATH = "/ws/watch";
