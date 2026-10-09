import type {
  GiteaClient,
  Issue,
  LoopTicket,
  LoopTicketSpec,
  Milestone,
} from "./gitea.js";

export type EntryStatus = "open" | "working" | "waiting" | "blocked" | "closed";

export interface Step {
  readonly text: string;
  readonly done: boolean;
}

/** One milestone issue as the loop tracks it, persisted in the progress ticket. */
export interface Entry {
  readonly number: number;
  readonly title: string;
  readonly status: EntryStatus;
  /** The session's own steps, from its latest `<<<STEPS` block. */
  readonly steps: readonly Step[];
  /** The session that worked it last; what a restart or an answer resumes. */
  readonly sessionId: string | null;
  /** While waiting: the question comment's id; replies after it may answer it. */
  readonly askedAt: number | null;
  readonly stashed: boolean;
}

/** Everything a restarted loop needs about one milestone. */
interface MilestoneState {
  questions: number | null;
  /** Question-ticket comments already delivered as answers. */
  consumed: number[];
  entries: Entry[];
}

export const PROGRESS_MARKER = "<!-- claudjar-loop:progress -->";
const STATE = /<!-- claudjar-loop:state ([A-Za-z0-9+/=]+) -->/;
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

const LABEL: Record<EntryStatus, string> = {
  open: "",
  working: " — 🔄 working",
  waiting: " — ❓ waiting for an answer",
  blocked: " — ⛔ blocked, see the issue",
  closed: "",
};

/** The progress ticket's body: a checklist for people, the state for a restart. */
export function renderProgress(
  milestone: Milestone,
  state: MilestoneState,
): string {
  const lines = [
    PROGRESS_MARKER,
    "",
    `Progress of \`claudjar loop\` on milestone **${milestone.title}**. Maintained by the`,
    "loop — edits to this description are overwritten.",
    "",
  ];
  for (const e of state.entries) {
    const waitingOn =
      e.status === "waiting" && state.questions !== null
        ? ` on #${String(state.questions)}`
        : "";
    lines.push(
      `- [${e.status === "closed" ? "x" : " "}] #${String(e.number)} ${e.title}${LABEL[e.status]}${waitingOn}`,
    );
    for (const s of e.steps)
      lines.push(`  - [${s.done ? "x" : " "}] ${s.text}`);
  }
  if (state.entries.length === 0) lines.push("_No open issues._");
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64");
  lines.push("", `<!-- claudjar-loop:state ${encoded} -->`);
  return lines.join("\n");
}

const STATUSES: readonly EntryStatus[] = [
  "open",
  "working",
  "waiting",
  "blocked",
  "closed",
];

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object"
    ? (v as Record<string, unknown>)
    : null;
}

function toEntry(v: unknown): Entry | null {
  const r = asRecord(v);
  if (!r || typeof r.number !== "number" || typeof r.title !== "string")
    return null;
  const status = STATUSES.find((s) => s === r.status) ?? "open";
  const steps = Array.isArray(r.steps)
    ? (r.steps as unknown[]).flatMap((s) => {
        const sr = asRecord(s);
        return sr && typeof sr.text === "string"
          ? [{ text: sr.text, done: sr.done === true }]
          : [];
      })
    : [];
  return {
    number: r.number,
    title: r.title,
    status,
    steps,
    sessionId: typeof r.sessionId === "string" ? r.sessionId : null,
    askedAt: typeof r.askedAt === "number" ? r.askedAt : null,
    stashed: r.stashed === true,
  };
}

/** The state a progress ticket's body carries; empty when it has none (or it is mangled). */
export function parseProgress(body: string): MilestoneState {
  const empty: MilestoneState = { questions: null, consumed: [], entries: [] };
  const m = STATE.exec(body);
  if (!m?.[1]) return empty;
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
  } catch {
    return empty;
  }
  const r = asRecord(raw);
  if (!r) return empty;
  return {
    questions: typeof r.questions === "number" ? r.questions : null,
    consumed: Array.isArray(r.consumed)
      ? (r.consumed as unknown[]).filter(
          (n): n is number => typeof n === "number",
        )
      : [],
    entries: Array.isArray(r.entries)
      ? (r.entries as unknown[])
          .map(toEntry)
          .filter((e): e is Entry => e !== null)
      : [],
  };
}

export const questionsSpec = (milestone: Milestone): LoopTicketSpec => ({
  marker: "<!-- claudjar-loop:questions -->",
  title: `Open questions — ${milestone.title}`,
  body: [
    "<!-- claudjar-loop:questions -->",
    "",
    `Questions \`claudjar loop\` sessions ask while working milestone **${milestone.title}**.`,
    "",
    "Answer by commenting here. Start the reply with the issue number (`#12 …`) when",
    "more than one question is waiting; otherwise it answers the oldest one. The loop",
    "resumes that issue's session with your answer, and closes this ticket when it",
    "finishes with nothing left to ask.",
  ].join("\n"),
});

interface Tracked {
  readonly milestone: Milestone;
  readonly ticket: LoopTicket;
  readonly state: MilestoneState;
  written: string;
}

/**
 * The milestone's progress ticket, and the loop's durable memory. Every status change
 * is written to the ticket's body — the checklist for the user, the state for the
 * next run — so a restarted loop resumes interrupted sessions and keeps waiting on
 * unanswered questions instead of starting them over.
 */
export class ProgressBoard {
  private readonly tracked = new Map<number, Tracked>();
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly gitea: GiteaClient,
    private readonly log: (line: string) => void,
  ) {}

  /** Find (or file) the milestone's progress ticket and read its state. */
  async load(milestone: Milestone): Promise<void> {
    const ticket = await this.gitea.ensureLoopTicket(milestone, {
      marker: PROGRESS_MARKER,
      title: `Loop progress — ${milestone.title}`,
      body: PROGRESS_MARKER,
    });
    this.tracked.set(milestone.id, {
      milestone,
      ticket,
      state: parseProgress(ticket.body),
      written: ticket.body,
    });
  }

  /**
   * Fold the milestone's current open issues in: new ones are appended, and tracked
   * ones no longer open were closed (by a session or by hand).
   */
  async sync(milestone: Milestone, open: readonly Issue[]): Promise<void> {
    const t = this.must(milestone.id);
    const openNumbers = new Set(open.map((i) => i.number));
    t.state.entries = t.state.entries.map((e) =>
      openNumbers.has(e.number) || e.status === "closed"
        ? e
        : { ...e, status: "closed" },
    );
    for (const i of open) {
      if (!t.state.entries.some((e) => e.number === i.number))
        t.state.entries.push(blank(i));
    }
    await this.write(t);
  }

  entry(issue: number): { entry: Entry; milestone: Milestone } | null {
    for (const t of this.tracked.values()) {
      const entry = t.state.entries.find((e) => e.number === issue);
      if (entry) return { entry, milestone: t.milestone };
    }
    return null;
  }

  /** Entries in `status`, across milestones, in milestone then list order. */
  inStatus(status: EntryStatus): { entry: Entry; milestone: Milestone }[] {
    return [...this.tracked.values()].flatMap((t) =>
      t.state.entries
        .filter((e) => e.status === status)
        .map((entry) => ({ entry, milestone: t.milestone })),
    );
  }

  async update(
    milestone: Milestone,
    issue: Issue,
    patch: Partial<Omit<Entry, "number" | "title">>,
  ): Promise<Entry> {
    const t = this.must(milestone.id);
    const at = t.state.entries.findIndex((e) => e.number === issue.number);
    const next: Entry = {
      ...(t.state.entries[at] ?? blank(issue)),
      ...patch,
    };
    if (at >= 0) t.state.entries[at] = next;
    else t.state.entries.push(next);
    await this.write(t);
    return next;
  }

  /** The milestone's questions ticket, filed on first use and remembered for restarts. */
  async questionsTicket(milestone: Milestone): Promise<LoopTicket> {
    const t = this.must(milestone.id);
    const ticket = await this.gitea.ensureLoopTicket(
      milestone,
      questionsSpec(milestone),
    );
    if (t.state.questions !== ticket.number) {
      t.state.questions = ticket.number;
      await this.write(t);
    }
    return ticket;
  }

  questionsNumber(milestone: Milestone): number | null {
    return this.must(milestone.id).state.questions;
  }

  isConsumed(milestone: Milestone, comment: number): boolean {
    return this.must(milestone.id).state.consumed.includes(comment);
  }

  async consume(milestone: Milestone, comment: number): Promise<void> {
    const t = this.must(milestone.id);
    t.state.consumed.push(comment);
    await this.write(t);
  }

  /**
   * Close the tickets that have nothing left to say: questions once none is waiting,
   * progress once every tracked issue is closed (so the milestone can complete).
   */
  async finish(): Promise<void> {
    await this.chain;
    for (const t of this.tracked.values()) {
      const entries = t.state.entries;
      if (
        t.state.questions !== null &&
        !entries.some((e) => e.status === "waiting")
      )
        await this.gitea.closeIssue(t.state.questions);
      if (entries.every((e) => e.status === "closed"))
        await this.gitea.closeIssue(t.ticket.number);
    }
  }

  private must(milestoneId: number): Tracked {
    const t = this.tracked.get(milestoneId);
    if (!t)
      throw new Error(`milestone ${String(milestoneId)} was never loaded`);
    return t;
  }

  /** Serialised, so a slow PATCH never lands after a newer one. */
  private write(t: Tracked): Promise<void> {
    this.chain = this.chain.then(async () => {
      const body = renderProgress(t.milestone, t.state);
      if (body === t.written) return;
      try {
        await this.gitea.editBody(t.ticket.number, body);
        t.written = body;
      } catch (err) {
        this.log(
          `--- could not update progress ticket #${String(t.ticket.number)}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
    return this.chain;
  }
}

function blank(issue: Issue): Entry {
  return {
    number: issue.number,
    title: issue.title,
    status: "open",
    steps: [],
    sessionId: null,
    askedAt: null,
    stashed: false,
  };
}
