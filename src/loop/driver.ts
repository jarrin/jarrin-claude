import { workOrder } from "./gitea.js";
import type { Comment, GiteaClient, Issue, Milestone } from "./gitea.js";
import { ProgressBoard, parseSteps } from "./progress.js";
import type { Entry } from "./progress.js";
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
  /** Desktop notification; `url` is what clicking it should open. Never throws. */
  readonly notify: (title: string, body: string, url: string) => void;
}

export interface LoopOptions {
  readonly repo: string;
  readonly milestones: readonly Milestone[];
  /** Stop after this many issues have been attempted (0 = no cap). */
  readonly maxIssues: number;
  /** Stop after this many issues in a row are left open (auth expired, broken gate…). */
  readonly maxFailures: number;
  /** How often to look for answers once nothing else is left to work. */
  readonly pollMs: number;
}

export interface LoopSummary {
  readonly closed: Issue[];
  readonly leftOpen: Issue[];
  /** Issues still waiting on an answer when the loop stopped. */
  readonly awaiting: Issue[];
  readonly stopReason: string;
  /** Every milestone drained: nothing capped, skipped as blocked, or awaiting an answer. */
  readonly clean: boolean;
}

const QUESTION_BLOCK = /<<<QUESTION\s*\n([\s\S]*?)\n\s*QUESTION>>>/;

/** The question a session ended on, or null when it did not ask one. */
export function parseQuestion(resultText: string): string | null {
  const m = QUESTION_BLOCK.exec(resultText);
  const q = m?.[1]?.trim();
  return q ? q : null;
}

/** Hidden marker on the loop's own comments, so they are never read as answers. */
const commentMarker = (kind: string, issue: Issue): string =>
  `<!-- claudjar-loop:${kind} #${String(issue.number)} -->`;
const isLoopComment = (c: Comment): boolean =>
  c.body.includes("<!-- claudjar-loop:");

const stashLabel = (issue: Issue): string =>
  `claudjar loop #${String(issue.number)}`;

export function issuePrompt(
  repo: string,
  issue: Issue,
  questions: number | null,
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
    "- Keep everything local: commit only. Never release (`claudjar release`, a version bump,",
    "  a tag, a forge release), never push — even if the issue asks for it. Pushing the result",
    "  is the loop's job once every issue is done; say in your issue comment if a release is due.",
    "- A choice the standing rules give to the user (a surprising commit sweep, a destructive",
    "  step, a decision only the user can make): ask it. Ask as early as you can, leave the",
    "  issue OPEN, and make your final message end with exactly this block, then stop:",
    "",
    "  <<<QUESTION",
    "  <the question, self-contained: context, the options, your recommendation>",
    "  QUESTION>>>",
    "",
    "  The loop posts it on the milestone's open-questions ticket — do not post it yourself.",
    "  It stashes any uncommitted work while you wait, and works other issues meanwhile.",
    "- Blocked with nothing to ask (broken environment, missing access): comment on the",
    "  issue what is needed and why, leave it OPEN, and stop. The loop then skips it.",
    ...(questions
      ? [
          `- Earlier answers may already be on the open-questions ticket #${String(questions)};`,
          "  read it for anything about this issue before asking again.",
        ]
      : []),
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

export function restartPrompt(issue: Issue): string {
  return (
    `\`claudjar loop\` was restarted while you worked issue #${String(issue.number)}. ` +
    "The working tree is as you left it. Carry on where you stopped, under the same " +
    "unattended rules: keep the <<<STEPS block current, close the issue when done, end " +
    "on a <<<QUESTION block to ask, or comment and leave it open when blocked."
  );
}

export function answerPrompt(
  issue: Issue,
  answers: readonly string[],
  stashed: boolean,
): string {
  return [
    `The user answered your question about issue #${String(issue.number)}:`,
    "",
    ...answers.map((a) => a.replace(/^/gm, "> ")),
    "",
    ...(stashed
      ? [
          `Your uncommitted work was stashed as "${stashLabel(issue)}" while you waited, and`,
          "other issues may have been committed since. Restore it first: find it with",
          "`git stash list` and `git stash pop` that entry, resolving any conflict.",
          "",
        ]
      : []),
    "Carry on under the same unattended rules: close the issue when done, end on another",
    "<<<QUESTION block to ask more, or comment and leave it open when blocked.",
  ].join("\n");
}

const LEADING_REF = /^\s*#(\d+)\b/;

interface Waiting {
  readonly entry: Entry;
  readonly milestone: Milestone;
}

/**
 * Hand each new non-loop comment on a questions ticket to one waiting issue: the one
 * its leading `#<n>` names, else the oldest question on that ticket. Delivered
 * comments are recorded on the progress ticket, so an answer is never delivered
 * twice — not even across a restart.
 */
async function collectAnswers(
  gitea: GiteaClient,
  board: ProgressBoard,
  waiting: readonly Waiting[],
): Promise<Map<number, string[]>> {
  const answers = new Map<number, string[]>();
  const byTicket = new Map<number, Waiting[]>();
  for (const w of waiting) {
    const ticket = board.questionsNumber(w.milestone);
    if (ticket === null) continue;
    byTicket.set(ticket, [...(byTicket.get(ticket) ?? []), w]);
  }
  for (const [ticket, group] of byTicket) {
    const oldestFirst = [...group].sort(
      (a, b) => (a.entry.askedAt ?? 0) - (b.entry.askedAt ?? 0),
    );
    for (const c of await gitea.comments(ticket)) {
      if (isLoopComment(c) || !c.body.trim()) continue;
      const ref = LEADING_REF.exec(c.body);
      const named = ref
        ? oldestFirst.find((w) => w.entry.number === Number(ref[1]))
        : undefined;
      const target =
        named ?? oldestFirst.find((w) => c.id > (w.entry.askedAt ?? 0));
      if (!target || c.id <= (target.entry.askedAt ?? 0)) continue;
      if (board.isConsumed(target.milestone, c.id)) continue;
      await board.consume(target.milestone, c.id);
      answers.set(target.entry.number, [
        ...(answers.get(target.entry.number) ?? []),
        c.body.trim(),
      ]);
    }
  }
  return answers;
}

/**
 * Work every open issue of `milestones`, in the order given, one fresh Claude
 * session per issue. Issues are re-listed before each pick, so follow-ups filed
 * mid-run (caveat / cleanup tickets) are picked up too. A usage limit pauses the
 * run until it resets and RESUMES the same session. A session that ends on a
 * question waits: the question goes to the milestone's open-questions ticket,
 * other issues are worked meanwhile, and the user's reply resumes that session.
 *
 * All of it is tracked on each milestone's progress ticket, which is also what a
 * restarted loop reads back: interrupted sessions are resumed first, and issues
 * still waiting on an answer keep waiting instead of starting over.
 */
export async function runLoop(
  deps: LoopDeps,
  opts: LoopOptions,
): Promise<LoopSummary> {
  const board = new ProgressBoard(deps.gitea, deps.log);
  for (const m of opts.milestones) {
    await board.load(m);
    await board.sync(m, await deps.gitea.openIssues(m));
  }
  const closed: Issue[] = [];
  const leftOpen: Issue[] = [];
  const attempted = new Set<number>();
  let failuresInRow = 0;
  let announcedWait = false;

  const summary = async (
    stopReason: string,
    drained = false,
  ): Promise<LoopSummary> => {
    await board.finish();
    const awaiting = board
      .inStatus("waiting")
      .map(({ entry }) => asIssue(entry));
    return {
      closed,
      leftOpen,
      awaiting,
      stopReason,
      clean: drained && leftOpen.length === 0 && awaiting.length === 0,
    };
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
        if (steps) void board.update(milestone, issue, { steps });
      },
    };
    await board.update(milestone, issue, {
      status: "working",
      askedAt: null,
      stashed: false,
    });
    let outcome = await deps.run(prompt, resume, issue, watch);
    while (outcome.limited) {
      const waitMs = limitWaitMs(outcome.resetsAt, deps.now());
      const until = new Date(deps.now() + waitMs).toLocaleString();
      deps.log(
        `--- usage limit hit; waiting until ${until}, then resuming #${String(issue.number)}`,
      );
      await deps.sleep(waitMs);
      outcome = outcome.sessionId
        ? await deps.run(resumePrompt(issue), outcome.sessionId, issue, watch)
        : await deps.run(
            issuePrompt(opts.repo, issue, board.questionsNumber(milestone)),
            null,
            issue,
            watch,
          );
    }

    if (await deps.gitea.isClosed(issue.number)) {
      closed.push(issue);
      failuresInRow = 0;
      await board.update(milestone, issue, { status: "closed" });
      deps.log(`=== #${String(issue.number)} closed`);
      return null;
    }

    const question = parseQuestion(outcome.resultText);
    if (question && outcome.sessionId) {
      const questions = await board.questionsTicket(milestone);
      const posted = await deps.gitea.comment(
        questions.number,
        [
          commentMarker("question", issue),
          `### #${String(issue.number)} ${issue.title}`,
          "",
          question,
          "",
          `_Reply in a comment. Start it with \`#${String(issue.number)}\` if more than one question is open._`,
        ].join("\n"),
      );
      const stashed = await deps.stash(stashLabel(issue));
      await board.update(milestone, issue, {
        status: "waiting",
        sessionId: outcome.sessionId,
        askedAt: posted.id,
        stashed,
      });
      failuresInRow = 0;
      announcedWait = false;
      deps.log(
        `=== #${String(issue.number)} asked a question — waiting for an answer on #${String(questions.number)}` +
          (stashed ? " (uncommitted work stashed)" : ""),
      );
      deps.notify(
        `claudjar loop: question on #${String(issue.number)}`,
        `${issue.title}\n\n${question.slice(0, 300)}`,
        posted.url || questions.url,
      );
      return null;
    }

    leftOpen.push(issue);
    failuresInRow++;
    await board.update(milestone, issue, { status: "blocked" });
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
    const issue = asIssue(entry);
    attempted.add(issue.number);
    deps.log(
      `\n=== #${String(issue.number)} was interrupted — ` +
        (entry.sessionId ? "resuming its session" : "starting it again"),
    );
    const stop = entry.sessionId
      ? await work(issue, milestone, restartPrompt(issue), entry.sessionId)
      : await work(
          issue,
          milestone,
          issuePrompt(opts.repo, issue, board.questionsNumber(milestone)),
          null,
        );
    if (stop) return summary(stop);
  }

  for (;;) {
    const waiting = board.inStatus("waiting");
    for (const w of waiting) attempted.add(w.entry.number);
    if (waiting.length > 0) {
      const answers = await collectAnswers(deps.gitea, board, waiting);
      const answered = waiting.find((w) => answers.has(w.entry.number));
      if (answered) {
        const { entry, milestone } = answered;
        const issue = asIssue(entry);
        deps.log(
          `\n=== #${String(issue.number)} answered — resuming its session`,
        );
        const stop = await work(
          issue,
          milestone,
          answerPrompt(issue, answers.get(issue.number) ?? [], entry.stashed),
          entry.sessionId,
        );
        if (stop) return summary(stop);
        continue;
      }
    }

    const capped = opts.maxIssues > 0 && attempted.size >= opts.maxIssues;
    let next: { issue: Issue; milestone: Milestone } | null = null;
    if (!capped) {
      for (const milestone of opts.milestones) {
        const open = workOrder(await deps.gitea.openIssues(milestone));
        await board.sync(milestone, open);
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
        issuePrompt(opts.repo, issue, board.questionsNumber(milestone)),
        null,
      );
      if (stop) return summary(stop);
      continue;
    }

    const reason = capped
      ? `reached --max-issues ${String(opts.maxIssues)}`
      : "no open issues left";
    if (waiting.length === 0) return summary(reason, !capped);
    if (!announcedWait) {
      const list = waiting.map((w) => `#${String(w.entry.number)}`).join(" ");
      deps.log(
        `--- ${reason}; waiting for answers to ${list} (Ctrl-C to stop)`,
      );
      announcedWait = true;
    }
    await deps.sleep(opts.pollMs);
  }
}

function asIssue(entry: Entry): Issue {
  return { number: entry.number, title: entry.title };
}
