import type { MilestoneRef } from "#shared/protocol";

/**
 * Where links to the forge point: its web root and the repo a loop works.
 * `url` is absent for a loop that predates sending it — then nothing links.
 */
export interface Forge {
  readonly url?: string;
  readonly repo: string;
  readonly milestones: readonly MilestoneRef[];
}

export const noForge: Forge = { repo: "", milestones: [] };

/** An issue's page; `undefined` when the forge or repo is unknown. */
export function issueUrl(
  forge: Forge,
  issue: number,
  repo: string = forge.repo,
): string | undefined {
  return forge.url && repo
    ? `${forge.url}/${repo}/issues/${String(issue)}`
    : undefined;
}

/** A milestone's page; `undefined` when the forge or repo is unknown. */
export function milestoneUrl(
  forge: Forge,
  id: number,
  repo: string = forge.repo,
): string | undefined {
  return forge.url && repo
    ? `${forge.url}/${repo}/milestone/${String(id)}`
    : undefined;
}

/** A piece of a log line: plain text, or a reference to an issue / milestone. */
export type RefSegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "issue"; readonly text: string; readonly issue: number }
  | {
      readonly kind: "milestone";
      readonly text: string;
      readonly milestone: number;
    };

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Split text into plain runs and the issue (`#123`) and milestone (by title)
 * references in it, so each reference can render as a link.
 */
export function refSegments(
  text: string,
  milestones: readonly MilestoneRef[] = [],
): RefSegment[] {
  // Longest title first, so a title containing another wins.
  const titles = milestones
    .filter((m) => m.title.trim())
    .sort((a, b) => b.title.length - a.title.length);
  const alternatives = [
    "(?<![\\w&])#(\\d+)\\b",
    ...titles.map((m) => `(${escape(m.title)})`),
  ];
  const pattern = new RegExp(alternatives.join("|"), "g");
  const out: RefSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    const [whole, issue] = match;
    if (issue !== undefined)
      out.push({ kind: "issue", text: whole, issue: Number(issue) });
    else {
      const title = match.slice(2).find((g) => g !== undefined);
      const m = titles.find((t) => t.title === title);
      out.push(
        m
          ? { kind: "milestone", text: whole, milestone: m.id }
          : { kind: "text", text: whole },
      );
    }
    last = at + whole.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
