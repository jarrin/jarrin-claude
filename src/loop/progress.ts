import type {
  Entry,
  EntryStatus,
  MilestoneRef,
  Step,
} from "../../monitor/shared/protocol.js";
import type { Issue, Milestone } from "./gitea.js";

export type { Entry, EntryStatus, Step };

const STEPS_BLOCK = /<<<STEPS\s*\n([\s\S]*?)\n\s*STEPS>>>/g;
const STEP_LINE = /^\s*[-*]\s*\[([ xX])\]\s*(.+?)\s*$/;

/** The steps of the LAST `<<<STEPS … STEPS>>>` block in `text`, or null without one. */
export function parseSteps(text: string): Step[] | null {
  let last: string | null = null;
  for (const m of text.matchAll(STEPS_BLOCK)) last = m[1] ?? null;
  if (last === null) return null;
  const steps: Step[] = [];
  for (const line of last.split("\n")) {
    const m = STEP_LINE.exec(line);
    if (m?.[2]) steps.push({ text: m[2], done: m[1] !== " " });
  }
  return steps.length ? steps : null;
}

/** Where a board's entries are saved after every change: the claudjar monitor. */
export type SaveBoard = (
  milestone: MilestoneRef,
  entries: readonly Entry[],
) => void;

/**
 * Each milestone's issues as the loop tracks them, and the loop's durable memory.
 * It starts from what the monitor stored last (so a restarted loop resumes
 * interrupted sessions and keeps waiting on unanswered questions) and hands
 * every change back to it.
 */
export class ProgressBoard {
  private readonly boards = new Map<
    number,
    { milestone: Milestone; entries: Entry[] }
  >();

  constructor(
    milestones: readonly Milestone[],
    stored: (milestone: Milestone) => readonly Entry[],
    private readonly save: SaveBoard,
  ) {
    for (const m of milestones)
      this.boards.set(m.id, { milestone: m, entries: [...stored(m)] });
  }

  /**
   * Fold the milestone's current open issues in: new ones are appended, and tracked
   * ones no longer open were closed (by a session or by hand). Returns the ids of
   * the questions those closed issues were waiting on: nothing will answer them now.
   */
  sync(milestone: Milestone, open: readonly Issue[]): string[] {
    const b = this.must(milestone.id);
    const openNumbers = new Set(open.map((i) => i.number));
    const orphaned: string[] = [];
    b.entries = b.entries.map((e) => {
      if (openNumbers.has(e.number) || e.status === "closed") return e;
      if (e.questionId) orphaned.push(e.questionId);
      return { ...e, status: "closed", questionId: null };
    });
    for (const i of open) {
      if (!b.entries.some((e) => e.number === i.number))
        b.entries.push(blank(i));
    }
    this.save(b.milestone, b.entries);
    return orphaned;
  }

  /** Entries in `status`, across milestones, in milestone then list order. */
  inStatus(status: EntryStatus): { entry: Entry; milestone: Milestone }[] {
    return [...this.boards.values()].flatMap((b) =>
      b.entries
        .filter((e) => e.status === status)
        .map((entry) => ({ entry, milestone: b.milestone })),
    );
  }

  update(
    milestone: Milestone,
    issue: Issue,
    patch: Partial<Omit<Entry, "number" | "title">>,
  ): Entry {
    const b = this.must(milestone.id);
    const at = b.entries.findIndex((e) => e.number === issue.number);
    const next: Entry = { ...(b.entries[at] ?? blank(issue)), ...patch };
    if (at >= 0) b.entries[at] = next;
    else b.entries.push(next);
    this.save(b.milestone, b.entries);
    return next;
  }

  private must(milestoneId: number): {
    milestone: Milestone;
    entries: Entry[];
  } {
    const b = this.boards.get(milestoneId);
    if (!b) throw new Error(`milestone ${String(milestoneId)} is not tracked`);
    return b;
  }
}

function blank(issue: Issue): Entry {
  return {
    number: issue.number,
    title: issue.title,
    status: "open",
    steps: [],
    sessionId: null,
    questionId: null,
    stashed: false,
  };
}
