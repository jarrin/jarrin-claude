import { z } from "zod";

import type { AgentMessage, LogKind, WatcherMessage } from "#shared/protocol";

const MAX_TEXT = 64 * 1024;

const logKind = z.enum([
  "loop",
  "text",
  "thinking",
  "tool",
  "output",
  "error",
  "result",
  "system",
] as const satisfies readonly LogKind[]);

const logLine = z.object({
  t: z.number(),
  kind: logKind,
  text: z.string().transform((s) => s.slice(0, MAX_TEXT)),
  issue: z.number().int().optional(),
});

const instanceInfo = z.object({
  id: z.string().min(1).max(64),
  host: z.string().min(1).max(128),
  repo: z.string().max(256),
  milestones: z.array(z.string().max(256)).max(32),
  pid: z.number().int(),
  startedAt: z.number(),
});

const agentMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    instance: instanceInfo,
    token: z.string().optional(),
  }),
  z.object({ type: z.literal("log"), lines: z.array(logLine).max(5000) }),
  z.object({ type: z.literal("status"), status: z.string().max(512) }),
]) satisfies z.ZodType<AgentMessage>;

const watcherMessage = z.object({
  type: z.literal("dismiss"),
  id: z.string(),
}) satisfies z.ZodType<WatcherMessage>;

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
