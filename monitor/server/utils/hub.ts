import { boardKey, covers } from "#shared/protocol";
import type {
  AgentMessage,
  Board,
  ControlAction,
  Entry,
  InstanceInfo,
  InstanceSummary,
  InstanceView,
  LiveLog,
  LiveLogInfo,
  LivePost,
  LogLine,
  MilestoneRef,
  Question,
  ServerMessage,
  WatchMessage,
} from "#shared/protocol";

/** Lines kept per instance; older ones scroll off. */
export const MAX_LINES = 5000;
/** An offline instance is forgotten after this long — unless a question still needs it. */
export const OFFLINE_TTL_MS = 24 * 60 * 60 * 1000;

/** Live logs kept; the oldest finished one goes first. */
export const MAX_LIVE = 50;
/** Characters kept per live log; older content scrolls off. */
export const MAX_LIVE_TEXT = 256 * 1024;
/** A live log that has not grown for this long is closed, whatever its follower said. */
export const LIVE_STALE_MS = 2 * 60 * 60 * 1000;

interface Instance {
  info: InstanceInfo;
  online: boolean;
  status: string;
  paused: boolean;
  lastSeen: number;
  lines: LogLine[];
}

/** What outlives a restart. Log lines do not: they are a live view only. */
export interface Saved {
  readonly instances: readonly InstanceSummary[];
  readonly boards: readonly Board[];
  readonly questions: readonly Question[];
}

export type Send = (msg: WatchMessage) => void;
export type SendAgent = (msg: ServerMessage) => void;
type AskPayload = Extract<AgentMessage, { type: "ask" }>["question"];

/**
 * State of every loop instance, the durable store behind them (milestone boards
 * and open questions), and the fan-out to watching browsers and connected loops.
 * `persist` is called after every durable change; the caller debounces it.
 */
export class Hub {
  private readonly instances = new Map<string, Instance>();
  private readonly boards = new Map<string, Board>();
  private readonly questions = new Map<string, Question>();
  private readonly watchers = new Set<Send>();
  private readonly agents = new Map<string, SendAgent>();
  private readonly live = new Map<string, LiveLog>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly persist: (saved: Saved) => void = () => {},
  ) {}

  /** Restore what a previous process saved; every instance comes back offline. */
  restore(saved: Saved): void {
    for (const s of saved.instances) {
      const { online: _online, status, paused, lastSeen, ...info } = s;
      this.instances.set(info.id, {
        info,
        online: false,
        status,
        paused,
        lastSeen,
        lines: [],
      });
    }
    for (const b of saved.boards)
      this.boards.set(boardKey(b.repo, b.milestone.id), b);
    for (const q of saved.questions) this.questions.set(q.id, q);
  }

  watch(send: Send): () => void {
    this.prune();
    this.watchers.add(send);
    send({
      type: "snapshot",
      instances: [...this.instances.values()].map(view),
      boards: [...this.boards.values()],
      questions: [...this.questions.values()],
      live: [...this.live.values()],
    });
    return () => this.watchers.delete(send);
  }

  /** An agent (re)connected: register it and hand it the stored state of its milestones. */
  hello(info: InstanceInfo, send: SendAgent): void {
    const existing = this.instances.get(info.id);
    const inst: Instance = existing ?? {
      info,
      online: true,
      status: "running",
      paused: false,
      lastSeen: this.now(),
      lines: [],
    };
    inst.info = info;
    inst.online = true;
    inst.lastSeen = this.now();
    this.instances.set(info.id, inst);
    this.agents.set(info.id, send);
    send({
      type: "welcome",
      boards: [...this.boards.values()].filter((b) => covers(info, b)),
      questions: [...this.questions.values()].filter((q) => covers(info, q)),
    });
    this.broadcastSummary(inst);
    this.save();
  }

  log(id: string, lines: readonly LogLine[]): void {
    const inst = this.instances.get(id);
    if (!inst || lines.length === 0) return;
    inst.lines.push(...lines);
    if (inst.lines.length > MAX_LINES)
      inst.lines.splice(0, inst.lines.length - MAX_LINES);
    inst.lastSeen = this.now();
    this.broadcast({ type: "log", id, lines });
    for (const l of lines)
      if (l.detail?.type === "tail" && l.call)
        this.liveAppend(
          {
            id: l.call,
            file: l.detail.file,
            command: commandOf(inst.lines, l.call),
            source: {
              kind: "loop",
              host: inst.info.host,
              where: inst.info.repo,
              session: id,
            },
            startedAt: l.t,
          },
          l.text,
          l.detail.done,
        );
  }

  /** A hook follower sent the next chunk of a file a session's Bash call writes. */
  livePost(post: LivePost): void {
    const { token: _token, chunk, done, ...meta } = post;
    this.liveAppend(meta, chunk, done);
  }

  private liveAppend(
    meta: Omit<LiveLogInfo, "updatedAt" | "done">,
    chunk: string,
    done: boolean,
  ): void {
    const prev = this.live.get(meta.id);
    // A late chunk after the end (a retried post) changes nothing.
    if (prev?.done) return;
    const text = ((prev?.text ?? "") + chunk).slice(-MAX_LIVE_TEXT);
    const log: LiveLog = {
      ...meta,
      ...(prev
        ? { startedAt: prev.startedAt, command: prev.command || meta.command }
        : {}),
      updatedAt: this.now(),
      done,
      text,
    };
    // Re-inserted, so the map stays in order of last activity.
    this.live.delete(meta.id);
    this.live.set(meta.id, log);
    const { text: _text, ...info } = log;
    this.broadcast({ type: "live", log: info, chunk });
    this.pruneLive();
  }

  /** Close stale logs, then drop the least recently active beyond the cap. */
  private pruneLive(): void {
    const cutoff = this.now() - LIVE_STALE_MS;
    for (const log of this.live.values())
      if (!log.done && log.updatedAt < cutoff) {
        const closed = { ...log, done: true };
        this.live.set(log.id, closed);
        const { text: _text, ...info } = closed;
        this.broadcast({ type: "live", log: info, chunk: "" });
      }
    for (const id of this.live.keys()) {
      if (this.live.size <= MAX_LIVE) break;
      this.live.delete(id);
      this.broadcast({ type: "live-removed", id });
    }
  }

  status(id: string, status: string, paused: boolean): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    inst.status = status;
    inst.paused = paused;
    inst.lastSeen = this.now();
    this.broadcastSummary(inst);
    this.save();
  }

  progress(
    id: string,
    milestone: MilestoneRef,
    entries: readonly Entry[],
  ): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    const board: Board = {
      repo: inst.info.repo,
      milestone,
      entries: [...entries],
      updatedAt: this.now(),
    };
    this.boards.set(boardKey(board.repo, milestone.id), board);
    this.broadcast({ type: "board", board });
    this.save();
  }

  /** A session asked; a re-sent ask (same id, after a reconnect) is a no-op. */
  ask(id: string, q: AskPayload): void {
    const inst = this.instances.get(id);
    if (!inst || this.questions.has(q.id)) return;
    const question: Question = {
      ...q,
      repo: inst.info.repo,
      askedAt: this.now(),
      answer: null,
      answeredAt: null,
    };
    this.questions.set(q.id, question);
    this.broadcast({ type: "question", question });
    this.save();
  }

  resolved(questionId: string): void {
    if (!this.questions.delete(questionId)) return;
    this.broadcast({ type: "question-closed", id: questionId });
    this.save();
  }

  /** A watcher answered; every connected loop on that milestone is told at once. */
  answer(questionId: string, text: string): void {
    const q = this.questions.get(questionId);
    if (!q || !text.trim()) return;
    const answered: Question = {
      ...q,
      answer: text.trim(),
      answeredAt: this.now(),
    };
    this.questions.set(questionId, answered);
    this.broadcast({ type: "question", question: answered });
    for (const inst of this.instances.values())
      if (inst.online && covers(inst.info, answered))
        this.agents.get(inst.info.id)?.({
          type: "answer",
          questionId,
          text: answered.answer ?? "",
        });
    this.save();
  }

  control(id: string, action: ControlAction): void {
    this.agents.get(id)?.({ type: "control", action });
  }

  input(id: string, text: string): void {
    if (text.trim())
      this.agents.get(id)?.({ type: "input", text: text.trim() });
  }

  disconnect(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    inst.online = false;
    inst.lastSeen = this.now();
    this.agents.delete(id);
    this.broadcastSummary(inst);
    this.save();
  }

  /** A watcher closed a tab. Only offline instances with no open question can go. */
  dismiss(id: string): void {
    const inst = this.instances.get(id);
    if (!inst || inst.online || this.hasQuestions(inst)) return;
    this.instances.delete(id);
    this.broadcast({ type: "removed", id });
    this.save();
  }

  private hasQuestions(inst: Instance): boolean {
    return [...this.questions.values()].some((q) => covers(inst.info, q));
  }

  private prune(): void {
    const cutoff = this.now() - OFFLINE_TTL_MS;
    for (const [id, inst] of this.instances)
      if (!inst.online && inst.lastSeen < cutoff && !this.hasQuestions(inst))
        this.instances.delete(id);
  }

  private save(): void {
    this.persist({
      instances: [...this.instances.values()].map(summary),
      boards: [...this.boards.values()],
      questions: [...this.questions.values()],
    });
  }

  private broadcastSummary(inst: Instance): void {
    this.broadcast({ type: "instance", instance: summary(inst) });
  }

  private broadcast(msg: WatchMessage): void {
    for (const send of this.watchers) send(msg);
  }
}

/** The command of the Bash call a loop's `tail` line belongs to. */
function commandOf(lines: readonly LogLine[], call: string): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (l?.kind === "tool" && l.call === call && l.detail?.type === "command")
      return l.detail.command;
  }
  return "";
}

function summary(inst: Instance): InstanceSummary {
  return {
    ...inst.info,
    online: inst.online,
    status: inst.status,
    paused: inst.paused,
    lastSeen: inst.lastSeen,
  };
}

function view(inst: Instance): InstanceView {
  return { ...summary(inst), lines: [...inst.lines] };
}
