import { z } from "zod";

import type {
  AgentMessage,
  Board,
  Entry,
  EntryStatus,
  InstanceSummary,
  LogDetail,
  LivePost,
  LogKind,
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
    action: z.enum(["pause", "resume"]),
  }),
  z.object({ type: z.literal("input"), id: z.string(), text: questionText }),
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

export const parseLivePost = (raw: string): LivePost | null =>
  parseWith(livePost, raw);

export const parseSaved = (raw: string): Saved | null => parseWith(saved, raw);
