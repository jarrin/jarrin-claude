import { workOrder } from "./gitea.js";
import type { GiteaClient, Issue, Milestone } from "./gitea.js";
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
}

export interface LoopOptions {
  readonly repo: string;
  readonly milestones: readonly Milestone[];
  /** Stop after this many issues have been attempted (0 = no cap). */
  readonly maxIssues: number;
  /** Stop after this many issues in a row are left open (auth expired, broken gate…). */
  readonly maxFailures: number;
}

export interface LoopSummary {
  readonly closed: Issue[];
  readonly leftOpen: Issue[];
  readonly stopReason: string;
}

export function issuePrompt(repo: string, issue: Issue): string {
  return [
    `Continue ${String(issue.number)}`,
    "",
    `You are running UNATTENDED inside \`claudjar loop\`, which works the issues of a Gitea`,
    `milestone in ${repo} one at a time, each in a fresh session. Nobody reads your replies`,
    "while it runs, and nobody can answer a question.",
    "",
    `- Work issue #${String(issue.number)} ("${issue.title}") and ONLY that issue, following the`,
    '  staged-planning "Continue <number>" rules (or the todo rules for a todo ticket).',
    "- Finished and the repo's gate is green: commit per the standing rules, comment the",
    "  outcome on the issue, then close it. Closing is how the loop knows it is done.",
    "- Never ask. A choice the standing rules give to the user (a surprising commit sweep, a",
    "  destructive step, a decision only the user can make) means you are BLOCKED: comment on",
    "  the issue what is needed and why, leave it OPEN, and stop. The loop then skips it.",
    "- Stop once the issue is closed or blocked; the loop starts the next issue itself.",
  ].join("\n");
}

export function resumePrompt(issue: Issue): string {
  return (
    `The usage limit has reset. Carry on with issue #${String(issue.number)} exactly where ` +
    "you left off, under the same unattended rules: close it when done, or comment and " +
    "leave it open when blocked."
  );
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
 * run until it resets and RESUMES the same session; context is only discarded once
 * an issue is closed or given up on.
 */
export async function runLoop(
  deps: LoopDeps,
  opts: LoopOptions,
): Promise<LoopSummary> {
  const closed: Issue[] = [];
  const leftOpen: Issue[] = [];
  const attempted = new Set<number>();
  let failuresInRow = 0;

  for (;;) {
    if (opts.maxIssues > 0 && attempted.size >= opts.maxIssues) {
      return {
        closed,
        leftOpen,
        stopReason: `reached --max-issues ${String(opts.maxIssues)}`,
      };
    }
    const next = await pickNext(deps, opts.milestones, attempted);
    if (!next) return { closed, leftOpen, stopReason: "no open issues left" };
    const { issue, milestone } = next;
    attempted.add(issue.number);
    deps.log(
      `\n=== #${String(issue.number)} ${issue.title}  [${milestone.title}]`,
    );

    let outcome = await deps.run(issuePrompt(opts.repo, issue), null, issue);
    while (outcome.limited) {
      const waitMs = limitWaitMs(outcome.resetsAt, deps.now());
      const until = new Date(deps.now() + waitMs).toLocaleString();
      deps.log(
        `--- usage limit hit; waiting until ${until}, then resuming #${String(issue.number)}`,
      );
      await deps.sleep(waitMs);
      outcome = outcome.sessionId
        ? await deps.run(resumePrompt(issue), outcome.sessionId, issue)
        : await deps.run(issuePrompt(opts.repo, issue), null, issue);
    }

    if (await deps.gitea.isClosed(issue.number)) {
      closed.push(issue);
      failuresInRow = 0;
      deps.log(`=== #${String(issue.number)} closed`);
      continue;
    }
    leftOpen.push(issue);
    failuresInRow++;
    deps.log(
      `=== #${String(issue.number)} left open — skipping it` +
        (outcome.isError && outcome.resultText
          ? ` (${outcome.resultText.slice(0, 200)})`
          : ""),
    );
    if (opts.maxFailures > 0 && failuresInRow >= opts.maxFailures) {
      return {
        closed,
        leftOpen,
        stopReason: `${String(failuresInRow)} issues in a row were left open — stopping`,
      };
    }
  }
}
