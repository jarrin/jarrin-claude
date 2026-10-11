import { covers, detailKey, instanceLabel } from "#shared/protocol";
import type {
  Board,
  CommandOutcome,
  HostView,
  InstanceView,
  LiveLog,
  ProjectDetailView,
  Question,
  WatchMessage,
} from "#shared/protocol";

/** Mirrors the server's per-instance cap, so a long-open tab stays bounded. */
export const MAX_VIEW_LINES = 5000;
/** Mirrors the server's per-log cap on live log text. */
export const MAX_LIVE_TEXT = 256 * 1024;
/** Command outcomes kept for display, newest last. */
export const MAX_OUTCOMES = 50;

/** Everything the page shows, as the watch stream builds it. */
export interface MonitorState {
  readonly instances: readonly InstanceView[];
  readonly boards: readonly Board[];
  readonly questions: readonly Question[];
  /** Live logs, least recently active first. */
  readonly live: readonly LiveLog[];
  /** Machines running `claudjar service`, by host name. */
  readonly hosts: readonly HostView[];
  /** The content of each active project's tab, as its host last collected it. */
  readonly details: readonly ProjectDetailView[];
  /** Outcomes of host commands since this page connected, oldest first. */
  readonly outcomes: readonly CommandOutcome[];
}

export const emptyState: MonitorState = {
  instances: [],
  boards: [],
  questions: [],
  live: [],
  hosts: [],
  details: [],
  outcomes: [],
};

/** Fold one server message into the state (pure, for testing). */
export function applyWatchMessage(
  state: MonitorState,
  msg: WatchMessage,
): MonitorState {
  switch (msg.type) {
    case "snapshot":
      return {
        instances: [...msg.instances],
        boards: [...msg.boards],
        questions: [...msg.questions],
        live: [...msg.live],
        hosts: [...msg.hosts],
        details: [...msg.details],
        // Outcomes are not part of the server's state; a reconnect keeps ours.
        outcomes: state.outcomes,
      };
    case "instance": {
      const known = state.instances.some((x) => x.id === msg.instance.id);
      return {
        ...state,
        instances: known
          ? state.instances.map((x) =>
              x.id === msg.instance.id
                ? { ...x, ...msg.instance, lines: x.lines }
                : x,
            )
          : [...state.instances, { ...msg.instance, lines: [] }],
      };
    }
    case "log":
      return {
        ...state,
        instances: state.instances.map((x) =>
          x.id === msg.id
            ? {
                ...x,
                lines: [...x.lines, ...msg.lines].slice(-MAX_VIEW_LINES),
              }
            : x,
        ),
      };
    case "removed":
      return {
        ...state,
        instances: state.instances.filter((x) => x.id !== msg.id),
      };
    case "board": {
      const same = (b: Board): boolean =>
        b.repo === msg.board.repo && b.milestone.id === msg.board.milestone.id;
      return {
        ...state,
        boards: state.boards.some(same)
          ? state.boards.map((b) => (same(b) ? msg.board : b))
          : [...state.boards, msg.board],
      };
    }
    case "question":
      return {
        ...state,
        questions: state.questions.some((q) => q.id === msg.question.id)
          ? state.questions.map((q) =>
              q.id === msg.question.id ? msg.question : q,
            )
          : [...state.questions, msg.question],
      };
    case "question-closed":
      return {
        ...state,
        questions: state.questions.filter((q) => q.id !== msg.id),
      };
    case "live": {
      const prev = state.live.find((l) => l.id === msg.log.id);
      const log: LiveLog = {
        ...msg.log,
        text: ((prev?.text ?? "") + msg.chunk).slice(-MAX_LIVE_TEXT),
      };
      return {
        ...state,
        live: [...state.live.filter((l) => l.id !== log.id), log],
      };
    }
    case "live-removed":
      return { ...state, live: state.live.filter((l) => l.id !== msg.id) };
    case "host":
      return {
        ...state,
        hosts: state.hosts.some((h) => h.host === msg.host.host)
          ? state.hosts.map((h) => (h.host === msg.host.host ? msg.host : h))
          : [...state.hosts, msg.host],
      };
    case "project-detail": {
      const key = detailKey(msg.detail.host, msg.detail.project);
      return {
        ...state,
        details: [
          ...state.details.filter((d) => detailKey(d.host, d.project) !== key),
          msg.detail,
        ],
      };
    }
    case "project-detail-removed":
      return {
        ...state,
        details: state.details.filter(
          (d) => d.host !== msg.host || d.project !== msg.project,
        ),
      };
    case "command-result":
      return {
        ...state,
        outcomes: [...state.outcomes, msg.result].slice(-MAX_OUTCOMES),
      };
  }
}

/** The boards an instance works, in its milestone order. */
export function boardsOf(state: MonitorState, inst: InstanceView): Board[] {
  return inst.milestones.flatMap((m) =>
    state.boards.filter((b) => b.repo === inst.repo && b.milestone.id === m.id),
  );
}

/** Open questions on an instance's milestones, oldest first. */
export function questionsOf(
  state: MonitorState,
  inst: InstanceView,
): Question[] {
  return state.questions
    .filter((q) => covers(inst, q))
    .sort((a, b) => a.askedAt - b.askedAt);
}

/** A desktop notification the page should raise. */
export interface Notice {
  readonly title: string;
  readonly body: string;
  /** Same tag replaces an older notification instead of stacking. */
  readonly tag: string;
  /** The tab to open when it is clicked. */
  readonly instanceId: string | null;
}

const ENDED = /^(finished|interrupted)/;

/**
 * What is worth a desktop notification in `msg`, judged against the state before
 * it: a new question, an issue that turned blocked, a loop that stopped. Snapshots
 * never notify — they replay what the user has already seen.
 */
export function noticesFor(prev: MonitorState, msg: WatchMessage): Notice[] {
  const instanceFor = (item: Pick<Board, "repo" | "milestone">) =>
    prev.instances.find((i) => i.online && covers(i, item)) ??
    prev.instances.find((i) => covers(i, item)) ??
    null;
  switch (msg.type) {
    case "question": {
      const q = msg.question;
      if (prev.questions.some((x) => x.id === q.id)) return [];
      return [
        {
          title: `Question on #${String(q.issue)} — ${q.milestone.title}`,
          body: `${q.title}\n\n${q.text.slice(0, 300)}`,
          tag: `question-${q.id}`,
          instanceId: instanceFor(q)?.id ?? null,
        },
      ];
    }
    case "board": {
      const before = prev.boards.find(
        (b) =>
          b.repo === msg.board.repo &&
          b.milestone.id === msg.board.milestone.id,
      );
      return msg.board.entries
        .filter(
          (e) =>
            e.status === "blocked" &&
            before?.entries.find((x) => x.number === e.number)?.status !==
              "blocked",
        )
        .map((e) => ({
          title: `#${String(e.number)} is blocked — ${msg.board.milestone.title}`,
          body: `${e.title}\n\nThe session left it open; see the issue.`,
          tag: `blocked-${msg.board.repo}-${String(e.number)}`,
          instanceId: instanceFor(msg.board)?.id ?? null,
        }));
    }
    case "instance": {
      const inst = msg.instance;
      const was = prev.instances.find((i) => i.id === inst.id);
      if (!was || !ENDED.test(inst.status) || ENDED.test(was.status)) return [];
      return [
        {
          title: `Loop ${inst.status.startsWith("finished") ? "finished" : "stopped"}`,
          body: `${instanceLabel(inst)}\n${inst.status}`,
          tag: `ended-${inst.id}`,
          instanceId: inst.id,
        },
      ];
    }
    default:
      return [];
  }
}

/** `HH:MM:SS` in the viewer's local time. */
export function clock(t: number): string {
  return new Date(t).toLocaleTimeString("en-GB", { hour12: false });
}
