import { z } from "zod";

import type {
  AgentMessage,
  Board,
  Entry,
  EntryStatus,
  HostCommand,
  HostMessage,
  HostView,
  InstanceSummary,
  LogDetail,
  LivePost,
  LogKind,
  ProjectDetail,
  ProjectDetailView,
  ProjectInfo,
  Question,
  WatcherMessage,
} from "#shared/protocol";

import type { Saved } from "./hub";

const MAX_TEXT = 64 * 1024;

const logKind = z.enum([
  "loop",
  "input",
  "text",
  "thinking",
  "tool",
  "output",
  "error",
  "result",
  "system",
  "tail",
] as const satisfies readonly LogKind[]);

const clipped = z.string().transform((s) => s.slice(0, MAX_TEXT));

const logDetail = z.discriminatedUnion("type", [
  z.object({ type: z.literal("command"), command: clipped }),
  z.object({ type: z.literal("input"), json: clipped }),
  z.object({
    type: z.literal("patch"),
    file: clipped,
    hunks: z
      .array(
        z.object({
          oldStart: z.number().int(),
          newStart: z.number().int(),
          lines: z.array(clipped).max(1000),
        }),
      )
      .max(200),
    omitted: z.number().int(),
  }),
  z.object({ type: z.literal("tail"), file: clipped, done: z.boolean() }),
]) satisfies z.ZodType<LogDetail>;

const logLine = z.object({
  t: z.number(),
  kind: logKind,
  text: clipped,
  issue: z.number().int().optional(),
  call: z.string().max(128).optional(),
  detail: logDetail.optional(),
});

const milestoneRef = z.object({
  id: z.number().int(),
  title: z.string().max(256),
});

const instanceInfo = z.object({
  id: z.string().min(1).max(64),
  host: z.string().min(1).max(128),
  repo: z.string().max(256),
  // Rendered as link targets, so only a web URL is accepted.
  forge: z
    .string()
    .max(256)
    .regex(/^https?:\/\/[^\s]+$/)
    .optional(),
  milestones: z.array(milestoneRef).max(32),
  pid: z.number().int(),
  startedAt: z.number(),
});

const entryStatus = z.enum([
  "open",
  "working",
  "waiting",
  "blocked",
  "closed",
] as const satisfies readonly EntryStatus[]);

const entry = z.object({
  number: z.number().int(),
  title: z.string().max(1024),
  status: entryStatus,
  steps: z
    .array(z.object({ text: z.string().max(2048), done: z.boolean() }))
    .max(200),
  sessionId: z.string().max(128).nullable(),
  questionId: z.string().max(64).nullable(),
  stashed: z.boolean(),
}) satisfies z.ZodType<Entry>;

const questionText = z.string().min(1).max(MAX_TEXT);

const agentMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    instance: instanceInfo,
    token: z.string().optional(),
  }),
  z.object({ type: z.literal("log"), lines: z.array(logLine).max(5000) }),
  z.object({
    type: z.literal("status"),
    status: z.string().max(512),
    paused: z.boolean(),
  }),
  z.object({
    type: z.literal("progress"),
    milestone: milestoneRef,
    entries: z.array(entry).max(1000),
  }),
  z.object({
    type: z.literal("ask"),
    question: z.object({
      id: z.string().min(1).max(64),
      milestone: milestoneRef,
      issue: z.number().int(),
      title: z.string().max(1024),
      text: questionText,
    }),
  }),
  z.object({ type: z.literal("resolved"), questionId: z.string().max(64) }),
]) satisfies z.ZodType<AgentMessage>;

const hostInfo = z.object({
  host: z.string().min(1).max(128),
  pid: z.number().int(),
  startedAt: z.number(),
});

const projectInfo = z.object({
  name: z.string().min(1).max(256),
  path: z.string().max(4096),
  configured: z.boolean(),
  backlogRepo: z.string().max(256),
  active: z.boolean(),
}) satisfies z.ZodType<ProjectInfo>;

const projectList = z.array(projectInfo).max(1000);

const projectDetail = z.object({
  project: z.string().min(1).max(256),
  repo: z.string().max(256),
  forge: z.string().max(1024),
  milestones: z
    .array(
      z.object({
        id: z.number().int(),
        title: z.string().max(256),
        openIssues: z.number().int().nonnegative(),
        closedIssues: z.number().int().nonnegative(),
      }),
    )
    .max(1000),
  worktrees: z
    .array(
      z.object({
        name: z.string().max(256),
        branch: z.string().max(256),
        path: z.string().max(4096),
        port: z.number().int().nonnegative(),
        milestone: z.string().max(256),
        session: z.enum(["running", "stopped", "none"]),
        // Absent from a host older than the field: no loop pinned.
        loopPid: z.number().int().nonnegative().default(0),
      }),
    )
    .max(1000),
  error: z.string().max(4096),
  collectedAt: z.number(),
}) satisfies z.ZodType<ProjectDetail>;

const hostCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("open-project"), project: z.string().max(256) }),
  z.object({ type: z.literal("close-project"), project: z.string().max(256) }),
  z.object({
    type: z.literal("refresh-project"),
    project: z.string().max(256),
  }),
  z.object({
    type: z.literal("create-worktree"),
    project: z.string().max(256),
    name: z.string().max(128).optional(),
    milestone: milestoneRef.optional(),
    mode: z.enum(["loop", "session"]),
  }),
  z.object({
    type: z.literal("stop-loop"),
    project: z.string().max(256),
    worktree: z.string().min(1).max(128),
  }),
  z.object({
    type: z.literal("resume-loop"),
    project: z.string().max(256),
    worktree: z.string().min(1).max(128),
  }),
  z.object({
    type: z.literal("merge-worktree"),
    project: z.string().max(256),
    worktree: z.string().min(1).max(128),
    remove: z.boolean(),
  }),
  z.object({
    type: z.literal("remove-worktree"),
    project: z.string().max(256),
    worktree: z.string().min(1).max(128),
  }),
]) satisfies z.ZodType<HostCommand>;

const commandId = z.string().min(1).max(64);

const hostMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("host-hello"),
    host: hostInfo,
    token: z.string().optional(),
    projects: projectList,
  }),
  z.object({ type: z.literal("projects"), projects: projectList }),
  z.object({ type: z.literal("project-state"), project: projectInfo }),
  z.object({ type: z.literal("project-detail"), detail: projectDetail }),
  z.object({
    type: z.literal("command-result"),
    result: z.object({
      id: commandId,
      ok: z.boolean(),
      error: z.string().max(4096),
    }),
  }),
]) satisfies z.ZodType<HostMessage>;

const watcherMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dismiss"), id: z.string() }),
  z.object({
    type: z.literal("answer"),
    questionId: z.string(),
    text: questionText,
  }),
  z.object({
    type: z.literal("control"),
    id: z.string(),
    action: z.enum(["pause", "resume", "stop"]),
  }),
  z.object({ type: z.literal("input"), id: z.string(), text: questionText }),
  z.object({ type: z.literal("dismiss-live"), id: z.string() }),
  z.object({
    type: z.literal("command"),
    id: commandId,
    host: z.string().max(128),
    command: hostCommand,
  }),
]) satisfies z.ZodType<WatcherMessage>;

const livePost = z.object({
  token: z.string().optional(),
  id: z.string().min(1).max(128),
  file: z.string().min(1).max(4096),
  command: clipped,
  source: z.object({
    kind: z.enum(["session", "loop"]),
    host: z.string().max(128),
    where: z.string().max(4096),
    session: z.string().max(128),
    milestone: z.string().max(256).optional(),
  }),
  startedAt: z.number(),
  chunk: z.string().max(256 * 1024),
  done: z.boolean(),
}) satisfies z.ZodType<LivePost>;

const board = z.object({
  repo: z.string(),
  milestone: milestoneRef,
  entries: z.array(entry),
  updatedAt: z.number(),
}) satisfies z.ZodType<Board>;

const question = z.object({
  id: z.string(),
  repo: z.string(),
  milestone: milestoneRef,
  issue: z.number().int(),
  title: z.string(),
  text: z.string(),
  askedAt: z.number(),
  answer: z.string().nullable(),
  answeredAt: z.number().nullable(),
}) satisfies z.ZodType<Question>;

const saved = z.object({
  instances: z.array(
    instanceInfo.extend({
      online: z.boolean(),
      status: z.string(),
      paused: z.boolean(),
      lastSeen: z.number(),
    }) satisfies z.ZodType<InstanceSummary>,
  ),
  boards: z.array(board),
  questions: z.array(question),
  // Added with the host channel; a state file written before it has none.
  hosts: z
    .array(
      hostInfo.extend({
        online: z.boolean(),
        lastSeen: z.number(),
        projects: z.array(projectInfo),
      }) satisfies z.ZodType<HostView>,
    )
    .default([]),
  // Added with the project tabs.
  details: z
    .array(
      projectDetail.extend({
        host: z.string().min(1).max(128),
      }) satisfies z.ZodType<ProjectDetailView>,
    )
    .default([]),
}) satisfies z.ZodType<Saved>;

function parseWith<T>(schema: z.ZodType<T>, raw: string): T | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = schema.safeParse(json);
  return result.success ? result.data : null;
}

export const parseAgentMessage = (raw: string): AgentMessage | null =>
  parseWith(agentMessage, raw);

export const parseWatcherMessage = (raw: string): WatcherMessage | null =>
  parseWith(watcherMessage, raw);

export const parseHostMessage = (raw: string): HostMessage | null =>
  parseWith(hostMessage, raw);

export const parseLivePost = (raw: string): LivePost | null =>
  parseWith(livePost, raw);

export const parseSaved = (raw: string): Saved | null => parseWith(saved, raw);
