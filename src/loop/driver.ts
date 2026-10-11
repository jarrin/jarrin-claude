import { workOrder } from "./gitea.js";
import type { GiteaClient, Issue, Milestone } from "./gitea.js";
import { ProgressBoard, parseSteps } from "./progress.js";
import type { Entry, SaveBoard } from "./progress.js";
import { limitWaitMs } from "./stream.js";
import type { RunOutcome, RunWatch } from "./stream.js";

/** One Claude run: a fresh session, or a resume of `resume` (limit, answer, restart). */
export type RunClaude = (
  prompt: string,
  resume: string | null,
  issue: Issue,
  watch: RunWatch,
) => Promise<RunOutcome>;

export interface LoopDeps {
  readonly gitea: GiteaClient;
  readonly run: RunClaude;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
  readonly log: (line: string) => void;
  /** Stash uncommitted work under `label`; true when there was any to stash. */
  readonly stash: (label: string) => Promise<boolean>;
  readonly store: LoopStore;
}

/**
 * The loop's durable state and its line to the user — the claudjar monitor. It
 * keeps each milestone's progress, relays questions and their answers (the
 * browser raises the notification), and carries pause / resume.
 */
export interface LoopStore {
  /** The milestone's entries as stored when the loop connected. */
  stored(milestone: Milestone): readonly Entry[];
  readonly save: SaveBoard;
  /** Relay a question to the user; returns its id. */
  ask(milestone: Milestone, issue: Issue, text: string): string;
  /** A question's answer (null while unanswered), or null when the store has no such question. */
  question(id: string): { readonly answer: string | null } | null;
  /** The loop resumed the session with the answer: close the question. */
  resolve(id: string): void;
  paused(): boolean;
  /**
   * The user aborted the loop (from the monitor, or by signal): the running
   * session is ended, its work stashed, and no new one starts.
   */
  stopped(): boolean;
  /** Resolves on the next answer, pause / resume or abort — or after `ms` at the latest. */
  wait(ms: number): Promise<void>;
  /** One line on what the loop is doing, shown next to its tab. */
  status(text: string): void;
}

export interface LoopOptions {
  readonly repo: string;
  readonly milestones: readonly Milestone[];
  /** Stop after this many issues have been attempted (0 = no cap). */
  readonly maxIssues: number;
  /** Stop after this many issues in a row are left open (auth expired, broken gate…). */
  readonly maxFailures: number;
  /** Longest wait between checks while paused or waiting on answers. */
  readonly pollMs: number;
  /** `--allow-prod`: sessions may release, deploy, use sudo and edit prod's `.env`. */
  readonly allowProd?: boolean;
}

export interface LoopSummary {
  readonly closed: Issue[];
  readonly leftOpen: Issue[];
  /** Issues still waiting on an answer when the loop stopped. */
  readonly awaiting: Issue[];
  readonly stopReason: string;
  /** Every milestone drained: nothing capped, skipped as blocked, or awaiting an answer. */
  readonly clean: boolean;
  /** The user aborted the loop; an interrupted session is left `working` for a restart. */
  readonly aborted: boolean;
}

/** The stop reason of an aborted loop. */
export const ABORTED = "aborted";

const QUESTION_BLOCK = /<<<QUESTION\s*\n([\s\S]*?)\n\s*QUESTION>>>/;

/** The question a session ended on, or null when it did not ask one. */
export function parseQuestion(resultText: string): string | null {
  const m = QUESTION_BLOCK.exec(resultText);
  const q = m?.[1]?.trim();
  return q ? q : null;
}

const stashLabel = (issue: Issue): string =>
  `claudjar loop #${String(issue.number)}`;

const LOCAL_ONLY = [
  "- Keep everything local: commit only. Never release (`claudjar release`, a version bump,",
  "  a tag, a forge release), never push — even if the issue asks for it. Pushing the result",
  "  is the loop's job once every issue is done; say in your issue comment if a release is due.",
];

const PROD_ALLOWED = [
  "- PRODUCTION IS ALLOWED for this run (`claudjar loop --allow-prod`): when the issue or the",
  "  repo's standing rules call for it, release (the repo's own release command, which may tag,",
  "  bump and push as part of it), deploy, use sudo, and edit the production host's `.env`.",
  "  Do it only for what the issue needs, after the gate is green and the work is committed,",
  "  and put the evidence (the version live, what changed in `.env`) in the issue comment.",
  "  Never force-push, never push a branch outside a release, and still ASK before anything",
  "  destructive or irreversible the issue does not name (deleting data, dropping volumes).",
];

export function issuePrompt(
  repo: string,
  issue: Issue,
  allowProd = false,
): string {
  return [
    `Continue ${String(issue.number)}`,
    "",
    `You are running UNATTENDED inside \`claudjar loop\`, which works the issues of a Gitea`,
    `milestone in ${repo} one at a time, each in a fresh session. Nobody reads your replies`,
    "while it runs. You cannot ask anything mid-session — but you can END the session on a",
    "question, which the loop relays to the user and answers by resuming this session.",
    "",
    `- Work issue #${String(issue.number)} ("${issue.title}") and ONLY that issue, following the`,
    '  staged-planning "Continue <number>" rules (or the todo rules for a todo ticket).',
    "- First, before any change, print your plan for the issue as a block the loop mirrors",
    "  onto the milestone's progress ticket. Print the whole block again, ticked, each time",
    "  a step is done (and when the plan changes):",
    "",
    "  <<<STEPS",
    "  - [ ] <step>",
    "  - [ ] <step>",
    "  STEPS>>>",
    "",
    "- Finished and the repo's gate is green: commit per the standing rules, comment the",
    "  outcome on the issue, then close it. Closing is how the loop knows it is done.",
    ...(allowProd ? PROD_ALLOWED : LOCAL_ONLY),
    "- A choice the standing rules give to the user (a surprising commit sweep, a destructive",
    "  step, a decision only the user can make): ask it. Ask as early as you can, leave the",
    "  issue OPEN, and make your final message end with exactly this block, then stop:",
    "",
    "  <<<QUESTION",
    "  <the question, self-contained: context, the options, your recommendation>",
    "  QUESTION>>>",
    "",
    "  Keep it short and compact: a line or two of context, the options as terse bullets,",
    "  your pick. No background the user already knows, no restating the issue.",
    "",
    "  The loop relays it to the user — do not post it on the forge yourself.",
    "  It stashes any uncommitted work while you wait, and works other issues meanwhile.",
    "- Blocked with nothing to ask (broken environment, missing access): comment on the",
    "  issue what is needed and why, leave it OPEN, and stop. The loop then skips it.",
    "- The user may send you notes while you work; they arrive as user messages. Take",
    "  them into account and carry on under these same rules.",
    "- Stop once the issue is closed, blocked, or asked about; the loop moves on itself.",
  ].join("\n");
}

export function resumePrompt(issue: Issue): string {
  return (
    `The usage limit has reset. Carry on with issue #${String(issue.number)} exactly where ` +
    "you left off, under the same unattended rules: close it when done, end on a " +
    "<<<QUESTION block to ask, or comment and leave it open when blocked."
  );
}

/** How a resumed session gets back the uncommitted work the loop stashed for it. */
function stashNote(issue: Issue, why: string): string[] {
  return [
    `Your uncommitted work was stashed as "${stashLabel(issue)}" ${why}, and`,
    "other issues may have been committed since. Restore it first: find it with",
    "`git stash list` and `git stash pop` that entry, resolving any conflict.",
  ];
}

export function restartPrompt(issue: Issue, stashed = false): string {
  return [
    `\`claudjar loop\` was restarted while you worked issue #${String(issue.number)}.`,
    ...(stashed
      ? stashNote(issue, "when the loop was aborted")
      : ["The working tree is as you left it."]),
    "Carry on where you stopped, under the same unattended rules: keep the <<<STEPS",
    "block current, close the issue when done, end on a <<<QUESTION block to ask, or",
    "comment and leave it open when blocked.",
  ].join("\n");
}

export function answerPrompt(
  issue: Issue,
  answer: string,
  stashed: boolean,
): string {
  return [
    `The user answered your question about issue #${String(issue.number)}:`,
    "",
    answer.replace(/^/gm, "> "),
    "",
    ...(stashed ? [...stashNote(issue, "while you waited"), ""] : []),
    "Carry on under the same unattended rules: close the issue when done, end on another",
    "<<<QUESTION block to ask more, or comment and leave it open when blocked.",
  ].join("\n");
}

/**
 * Work every open issue of `milestones`, in the order given, one fresh Claude
 * session per issue. Issues are re-listed before each pick, so follow-ups filed
 * mid-run (caveat / cleanup tickets) are picked up too. A usage limit pauses the
 * run until it resets and RESUMES the same session. A session that ends on a
 * question waits: the question is relayed to the user through the store, other
 * issues are worked meanwhile, and the user's answer resumes that session. While
 * paused, the current session runs to its end and no new one starts.
 *
 * All of it is kept in the store, which is also what a restarted loop reads
 * back: interrupted sessions are resumed first, and issues still waiting on an
 * answer keep waiting instead of starting over.
 */
export async function runLoop(
  deps: LoopDeps,
  opts: LoopOptions,
): Promise<LoopSummary> {
  const { store } = deps;
  const board = new ProgressBoard(
    opts.milestones,
    (m) => store.stored(m),
    store.save,
  );
  const sync = (m: Milestone, open: readonly Issue[]): void => {
    for (const id of board.sync(m, open)) store.resolve(id);
  };
  for (const m of opts.milestones) sync(m, await deps.gitea.openIssues(m));
  const closed: Issue[] = [];
  const leftOpen: Issue[] = [];
  const attempted = new Set<number>();
  let failuresInRow = 0;
  let announcedWait = false;

  /** Hold here while the user has the loop paused. */
  const holdWhilePaused = async (): Promise<void> => {
    if (!store.paused() || store.stopped()) return;
    deps.log("--- paused — resume from the monitor to carry on");
    store.status("paused");
    while (store.paused() && !store.stopped()) await store.wait(opts.pollMs);
    if (!store.stopped()) deps.log("--- resumed");
  };

  const summary = (stopReason: string, drained = false): LoopSummary => {
    const awaiting = board
      .inStatus("waiting")
      .map(({ entry }) => asIssue(entry));
    return {
      closed,
      leftOpen,
      awaiting,
      stopReason,
      clean: drained && leftOpen.length === 0 && awaiting.length === 0,
      aborted: stopReason === ABORTED,
    };
  };

  /**
   * The user aborted mid-session: the runner has ended it. Its uncommitted work
   * is stashed and the issue stays `working`, so a restarted loop resumes the
   * session and is told to restore the stash.
   */
  const abandon = async (
    issue: Issue,
    milestone: Milestone,
    sessionId: string | null,
  ): Promise<string> => {
    const stashed = await deps.stash(stashLabel(issue));
    board.update(milestone, issue, {
      status: "working",
      ...(sessionId ? { sessionId } : {}),
      stashed,
    });
    deps.log(
      `=== #${String(issue.number)} aborted — a restart resumes its session` +
        (stashed ? " (uncommitted work stashed)" : ""),
    );
    return ABORTED;
  };

  /** Run one session to its end — through any limit pauses — and record the result. */
  const work = async (
    issue: Issue,
    milestone: Milestone,
    prompt: string,
    resume: string | null,
  ): Promise<string | null> => {
    const watch: RunWatch = {
      session: (id) => void board.update(milestone, issue, { sessionId: id }),
      text: (text) => {
        const steps = parseSteps(text);
        if (steps) board.update(milestone, issue, { steps });
      },
    };
    board.update(milestone, issue, {
      status: "working",
      questionId: null,
      stashed: false,
    });
    store.status(`working #${String(issue.number)} ${issue.title}`);
    let outcome = await deps.run(prompt, resume, issue, watch);
    while (outcome.limited && !store.stopped()) {
      const waitMs = limitWaitMs(outcome.resetsAt, deps.now());
      const until = new Date(deps.now() + waitMs).toLocaleString();
      deps.log(
        `--- usage limit hit; waiting until ${until}, then resuming #${String(issue.number)}`,
      );
      store.status(
        `usage limit — resuming #${String(issue.number)} at ${until}`,
      );
      await deps.sleep(waitMs);
      if (store.stopped()) break;
      outcome = outcome.sessionId
        ? await deps.run(resumePrompt(issue), outcome.sessionId, issue, watch)
        : await deps.run(
            issuePrompt(opts.repo, issue, opts.allowProd),
            null,
            issue,
            watch,
          );
    }
    if (store.stopped() && !(await deps.gitea.isClosed(issue.number)))
      return abandon(issue, milestone, outcome.sessionId ?? resume);

    if (await deps.gitea.isClosed(issue.number)) {
      closed.push(issue);
      failuresInRow = 0;
      board.update(milestone, issue, { status: "closed" });
      deps.log(`=== #${String(issue.number)} closed`);
      return null;
    }

    const question = parseQuestion(outcome.resultText);
    if (question && outcome.sessionId) {
      const questionId = store.ask(milestone, issue, question);
      const stashed = await deps.stash(stashLabel(issue));
      board.update(milestone, issue, {
        status: "waiting",
        sessionId: outcome.sessionId,
        questionId,
        stashed,
      });
      failuresInRow = 0;
      announcedWait = false;
      deps.log(
        `=== #${String(issue.number)} asked a question — waiting for an answer on the monitor` +
          (stashed ? " (uncommitted work stashed)" : ""),
      );
      return null;
    }

    leftOpen.push(issue);
    failuresInRow++;
    board.update(milestone, issue, { status: "blocked" });
    deps.log(
      `=== #${String(issue.number)} left open — skipping it` +
        (outcome.isError && outcome.resultText
          ? ` (${outcome.resultText.slice(0, 200)})`
          : ""),
    );
    if (opts.maxFailures > 0 && failuresInRow >= opts.maxFailures)
      return `${String(failuresInRow)} issues in a row were left open — stopping`;
    return null;
  };

  // A previous loop died mid-session: pick those sessions up where they stopped.
  for (const { entry, milestone } of board.inStatus("working")) {
    await holdWhilePaused();
    if (store.stopped()) return summary(ABORTED);
    const issue = asIssue(entry);
    attempted.add(issue.number);
    deps.log(
      `\n=== #${String(issue.number)} was interrupted — ` +
        (entry.sessionId ? "resuming its session" : "starting it again"),
    );
    const stop = entry.sessionId
      ? await work(
          issue,
          milestone,
          restartPrompt(issue, entry.stashed),
          entry.sessionId,
        )
      : await work(
          issue,
          milestone,
          issuePrompt(opts.repo, issue, opts.allowProd),
          null,
        );
    if (stop) return summary(stop);
  }

  for (;;) {
    await holdWhilePaused();
    if (store.stopped()) return summary(ABORTED);
    const waiting = board.inStatus("waiting");
    for (const w of waiting) attempted.add(w.entry.number);
    let answered: { w: (typeof waiting)[number]; answer: string } | null = null;
    for (const w of waiting) {
      const q = w.entry.questionId ? store.question(w.entry.questionId) : null;
      if (!q) {
        // The monitor no longer knows the question (its state was lost): nothing
        // will ever answer it, so the issue is blocked rather than waited on forever.
        board.update(w.milestone, asIssue(w.entry), { status: "blocked" });
        leftOpen.push(asIssue(w.entry));
        deps.log(
          `=== #${String(w.entry.number)} lost its question on the monitor — skipping it`,
        );
        continue;
      }
      if (q.answer !== null && !answered) answered = { w, answer: q.answer };
    }
    if (answered) {
      const { entry, milestone } = answered.w;
      const issue = asIssue(entry);
      deps.log(
        `\n=== #${String(issue.number)} answered — resuming its session`,
      );
      const prompt = answerPrompt(issue, answered.answer, entry.stashed);
      // Working before resolved: a crash in between resumes the session instead
      // of waiting on a question the monitor has already closed.
      board.update(milestone, issue, { status: "working", questionId: null });
      if (entry.questionId) store.resolve(entry.questionId);
      const stop = await work(issue, milestone, prompt, entry.sessionId);
      if (stop) return summary(stop);
      continue;
    }

    const capped = opts.maxIssues > 0 && attempted.size >= opts.maxIssues;
    let next: { issue: Issue; milestone: Milestone } | null = null;
    if (!capped) {
      for (const milestone of opts.milestones) {
        const open = workOrder(await deps.gitea.openIssues(milestone));
        sync(milestone, open);
        const issue = open.find((i) => !attempted.has(i.number));
        if (issue) {
          next = { issue, milestone };
          break;
        }
      }
    }
    if (next) {
      const { issue, milestone } = next;
      attempted.add(issue.number);
      deps.log(
        `\n=== #${String(issue.number)} ${issue.title}  [${milestone.title}]`,
      );
      const stop = await work(
        issue,
        milestone,
        issuePrompt(opts.repo, issue, opts.allowProd),
        null,
      );
      if (stop) return summary(stop);
      continue;
    }

    const reason = capped
      ? `reached --max-issues ${String(opts.maxIssues)}`
      : "no open issues left";
    const stillWaiting = board.inStatus("waiting");
    if (stillWaiting.length === 0) return summary(reason, !capped);
    if (!announcedWait) {
      const list = stillWaiting
        .map((w) => `#${String(w.entry.number)}`)
        .join(" ");
      deps.log(
        `--- ${reason}; waiting for answers to ${list} (Ctrl-C to stop)`,
      );
      store.status(`waiting for answers to ${list}`);
      announcedWait = true;
    }
    await store.wait(opts.pollMs);
  }
}

function asIssue(entry: Entry): Issue {
  return { number: entry.number, title: entry.title };
}
