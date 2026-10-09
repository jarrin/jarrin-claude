import { workOrder } from "./gitea.js";
import type {
  Comment,
  GiteaClient,
  Issue,
  Milestone,
  QuestionsIssue,
} from "./gitea.js";
import { limitWaitMs } from "./stream.js";
import type { RunOutcome } from "./stream.js";

/** One Claude run: a fresh session, or a resume of `resume` after a limit lifted. */
export type RunClaude = (
  prompt: string,
  resume: string | null,
  issue: Issue,
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
  questions: QuestionsIssue | null,
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
    "- Finished and the repo's gate is green: commit per the standing rules, comment the",
    "  outcome on the issue, then close it. Closing is how the loop knows it is done.",
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
          `- Earlier answers may already be on the open-questions ticket #${String(questions.number)};`,
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

/** An issue whose session ended on a question, set aside until it is answered. */
interface Parked {
  readonly issue: Issue;
  readonly milestone: Milestone;
  readonly sessionId: string;
  readonly questions: QuestionsIssue;
  /** Comments after this one may answer it. */
  readonly askedAt: number;
  readonly stashed: boolean;
}

const LEADING_REF = /^\s*#(\d+)\b/;

/**
 * Hand each new non-loop comment on the questions tickets to one parked issue: the
 * one its leading `#<n>` names, else the oldest question on that ticket. Comments
 * are consumed once, so an answer is never delivered twice.
 */
async function collectAnswers(
  gitea: GiteaClient,
  parked: readonly Parked[],
  consumed: Set<number>,
): Promise<Map<number, string[]>> {
  const answers = new Map<number, string[]>();
  const byTicket = new Map<number, Parked[]>();
  for (const p of parked) {
    byTicket.set(p.questions.number, [
      ...(byTicket.get(p.questions.number) ?? []),
      p,
    ]);
  }
  for (const [ticket, waiting] of byTicket) {
    const oldestFirst = [...waiting].sort((a, b) => a.askedAt - b.askedAt);
    for (const c of await gitea.comments(ticket)) {
      if (consumed.has(c.id) || isLoopComment(c) || !c.body.trim()) continue;
      const ref = LEADING_REF.exec(c.body);
      const named = ref
        ? oldestFirst.find((p) => p.issue.number === Number(ref[1]))
        : undefined;
      const target = named ?? oldestFirst.find((p) => c.id > p.askedAt);
      if (!target || c.id <= target.askedAt) continue;
      consumed.add(c.id);
      answers.set(target.issue.number, [
        ...(answers.get(target.issue.number) ?? []),
        c.body.trim(),
      ]);
    }
  }
  return answers;
}

async function pickNext(
  deps: LoopDeps,
  milestones: readonly Milestone[],
  attempted: ReadonlySet<number>,
): Promise<{ issue: Issue; milestone: Milestone } | null> {
  for (const milestone of milestones) {
    const open = workOrder(await deps.gitea.openIssues(milestone));
    const issue = open.find((i) => !attempted.has(i.number));
    if (issue) return { issue, milestone };
  }
  return null;
}

/**
 * Work every open issue of `milestones`, in the order given, one fresh Claude
 * session per issue. Issues are re-listed before each pick, so follow-ups filed
 * mid-run (caveat / cleanup tickets) are picked up too. A usage limit pauses the
 * run until it resets and RESUMES the same session. A session that ends on a
 * question is parked: the question goes to the milestone's open-questions ticket,
 * other issues are worked meanwhile, and the user's reply resumes that session.
 */
export async function runLoop(
  deps: LoopDeps,
  opts: LoopOptions,
): Promise<LoopSummary> {
  const closed: Issue[] = [];
  const leftOpen: Issue[] = [];
  const attempted = new Set<number>();
  const parked = new Map<number, Parked>();
  const consumed = new Set<number>();
  const questionsByMilestone = new Map<number, QuestionsIssue>();
  let failuresInRow = 0;
  let announcedWait = false;

  const summary = async (stopReason: string): Promise<LoopSummary> => {
    // Nothing left to answer: the ticket would only hold the milestone open.
    if (parked.size === 0) {
      for (const q of questionsByMilestone.values())
        await deps.gitea.closeIssue(q.number);
    }
    return {
      closed,
      leftOpen,
      awaiting: [...parked.values()].map((p) => p.issue),
      stopReason,
    };
  };

  const finish = async (
    issue: Issue,
    milestone: Milestone,
    first: Promise<RunOutcome>,
  ): Promise<string | null> => {
    let outcome = await first;
    while (outcome.limited) {
      const waitMs = limitWaitMs(outcome.resetsAt, deps.now());
      const until = new Date(deps.now() + waitMs).toLocaleString();
      deps.log(
        `--- usage limit hit; waiting until ${until}, then resuming #${String(issue.number)}`,
      );
      await deps.sleep(waitMs);
      outcome = outcome.sessionId
        ? await deps.run(resumePrompt(issue), outcome.sessionId, issue)
        : await deps.run(
            issuePrompt(
              opts.repo,
              issue,
              questionsByMilestone.get(milestone.id) ?? null,
            ),
            null,
            issue,
          );
    }

    if (await deps.gitea.isClosed(issue.number)) {
      closed.push(issue);
      failuresInRow = 0;
      deps.log(`=== #${String(issue.number)} closed`);
      return null;
    }

    const question = parseQuestion(outcome.resultText);
    if (question && outcome.sessionId) {
      const questions = await deps.gitea.ensureQuestionsIssue(milestone);
      questionsByMilestone.set(milestone.id, questions);
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
      parked.set(issue.number, {
        issue,
        milestone,
        sessionId: outcome.sessionId,
        questions,
        askedAt: posted.id,
        stashed,
      });
      failuresInRow = 0;
      announcedWait = false;
      deps.log(
        `=== #${String(issue.number)} asked a question — parked until answered on #${String(questions.number)}` +
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

  for (;;) {
    if (parked.size > 0) {
      const answers = await collectAnswers(
        deps.gitea,
        [...parked.values()],
        consumed,
      );
      const answered = [...parked.values()].find((p) =>
        answers.has(p.issue.number),
      );
      if (answered) {
        const { issue, milestone } = answered;
        parked.delete(issue.number);
        deps.log(
          `\n=== #${String(issue.number)} answered — resuming its session`,
        );
        const stop = await finish(
          issue,
          milestone,
          deps.run(
            answerPrompt(
              issue,
              answers.get(issue.number) ?? [],
              answered.stashed,
            ),
            answered.sessionId,
            issue,
          ),
        );
        if (stop) return summary(stop);
        continue;
      }
    }

    const capped = opts.maxIssues > 0 && attempted.size >= opts.maxIssues;
    const next = capped
      ? null
      : await pickNext(deps, opts.milestones, attempted);
    if (next) {
      const { issue, milestone } = next;
      attempted.add(issue.number);
      deps.log(
        `\n=== #${String(issue.number)} ${issue.title}  [${milestone.title}]`,
      );
      const stop = await finish(
        issue,
        milestone,
        deps.run(
          issuePrompt(
            opts.repo,
            issue,
            questionsByMilestone.get(milestone.id) ?? null,
          ),
          null,
          issue,
        ),
      );
      if (stop) return summary(stop);
      continue;
    }

    const reason = capped
      ? `reached --max-issues ${String(opts.maxIssues)}`
      : "no open issues left";
    if (parked.size === 0) return summary(reason);
    if (!announcedWait) {
      const waiting = [...parked.keys()].map((n) => `#${String(n)}`).join(" ");
      deps.log(
        `--- ${reason}; waiting for answers to ${waiting} (Ctrl-C to stop)`,
      );
      announcedWait = true;
    }
    await deps.sleep(opts.pollMs);
  }
}
