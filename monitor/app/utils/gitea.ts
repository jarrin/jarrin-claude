import { z } from "zod";
import { parseJson } from "./json";

/**
 * The shapes the gitea MCP server returns (its `slim*` helpers), decoded from
 * a tool result's text. Each parser yields `undefined` when the result is not
 * that shape, so the caller falls back to the generic rendering.
 */

const ref = z.object({ id: z.number(), title: z.string() });

const milestone = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullish(),
  state: z.string(),
  open_issues: z.number(),
  closed_issues: z.number(),
  due_on: z.string().nullish(),
});
export type GiteaMilestone = z.infer<typeof milestone>;

const issue = z.object({
  number: z.number(),
  title: z.string(),
  state: z.string(),
  body: z.string().nullish(),
  user: z.string().nullish(),
  labels: z.array(z.string()).nullish(),
  assignees: z.array(z.string()).nullish(),
  milestone: ref.nullish(),
  comments: z.number().nullish(),
  is_pull: z.boolean().nullish(),
  repository: z.string().nullish(),
});
export type GiteaIssue = z.infer<typeof issue>;

const comment = z.object({
  id: z.number(),
  body: z.string(),
  user: z.string().nullish(),
  created_at: z.string().nullish(),
});
export type GiteaComment = z.infer<typeof comment>;

const label = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string().nullish(),
});
export type GiteaLabel = z.infer<typeof label>;

/** A list, keeping the items that parse; `more` counts what the loop clipped. */
export interface Listed<T> {
  readonly items: readonly T[];
  readonly more: number;
}

function one<T>(schema: z.ZodType<T>, text: string): T | undefined {
  const r = schema.safeParse(parseJson(text));
  return r.success ? r.data : undefined;
}

/**
 * The loop caps long arrays and appends a `… N more items` string, so a list is
 * parsed item by item rather than as a whole.
 */
function many<T>(schema: z.ZodType<T>, text: string): Listed<T> | undefined {
  const value = parseJson(text);
  if (!Array.isArray(value)) return undefined;
  const items: T[] = [];
  let more = 0;
  for (const v of value) {
    const r = schema.safeParse(v);
    if (r.success) items.push(r.data);
    else if (typeof v === "string") {
      const m = /^… (\d+) more items$/.exec(v);
      if (m) more += Number(m[1]);
      else return undefined;
    } else return undefined;
  }
  return { items, more };
}

export const parseMilestone = (text: string) => one(milestone, text);
export const parseMilestones = (text: string) => many(milestone, text);
export const parseIssue = (text: string) => one(issue, text);
export const parseIssues = (text: string) => many(issue, text);
export const parseComment = (text: string) => one(comment, text);
export const parseComments = (text: string) => many(comment, text);
export const parseLabels = (text: string) => many(label, text);

/** A plain-string result (`"Milestone deleted successfully"`), unquoted. */
export function parseMessage(text: string): string | undefined {
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** `owner` + `repo` from a gitea tool's input, as `owner/repo`. */
export function repoOf(owner: string, repo: string): string {
  return owner && repo ? `${owner}/${repo}` : "";
}
