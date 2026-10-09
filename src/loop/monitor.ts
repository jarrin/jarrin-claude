import { randomUUID } from "node:crypto";

import { AGENT_PATH } from "../../monitor/shared/protocol.js";
import { trustSystemCAs } from "./trust.js";
import type {
  AgentMessage,
  Board,
  Entry,
  InstanceInfo,
  LogDetail,
  LogKind,
  LogLine,
  MilestoneRef,
  ServerMessage,
} from "../../monitor/shared/protocol.js";
import type { LoopStore } from "./driver.js";

/**
 * The loop's link to the claudjar monitor (`monitor/` in this repo, served at e.g.
 * wss://claudjar.jarrin.nl): the live log feed, and the loop's durable store —
 * progress boards, questions and their answers, pause / resume, and the user's
 * input. The loop never fails because of it: everything queues while the socket
 * is down and is re-sent on reconnect under the same instance id.
 */
export interface Monitor extends LoopStore {
  /** The monitor's stored state, once it has welcomed this loop for the first time. */
  readonly ready: Promise<void>;
  /** One of the loop's own progress lines. */
  loop(text: string): void;
  /** One raw stream-json line from the session working `issue`. */
  stream(raw: string, issue: number): void;
  /** Flush what is queued (bounded wait), then disconnect for good. */
  close(): Promise<void>;
}

/** The subset of the WHATWG WebSocket the client uses; the global one fits. */
export interface SocketLike {
  readonly readyState: number;
  readonly bufferedAmount: number;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: ErrorEvent) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface MonitorOptions {
  readonly url: string;
  readonly token: string;
  readonly instance: InstanceInfo;
  /** Text the user sent the loop from the monitor. */
  readonly onInput?: (text: string) => void;
  readonly open?: (url: string) => SocketLike;
  readonly now?: () => number;
  readonly newId?: () => string;
}

const OPEN = 1;
const FLUSH_MS = 150;
const RECONNECT_MS = 3000;
const MAX_QUEUE = 5000;
const CLOSE_WAIT_MS = 3000;

/** `wss://host` → `wss://host/ws/agent`; an explicit path is kept. */
export function agentUrl(base: string): string {
  const url = new URL(base);
  if (url.pathname === "/" || url.pathname === "") url.pathname = AGENT_PATH;
  return url.toString();
}

type Ask = Extract<AgentMessage, { type: "ask" }>["question"];

export function connectMonitor(opts: MonitorOptions): Monitor {
  const now = opts.now ?? Date.now;
  const newId = opts.newId ?? randomUUID;
  const open =
    opts.open ??
    ((url: string): SocketLike => {
      trustSystemCAs();
      return new WebSocket(url);
    });
  const url = agentUrl(opts.url);
  let queue: LogLine[] = [];
  let status = "starting";
  let paused = false;
  let statusDirty = true;
  /** Latest entries per milestone, and which still have to be sent. */
  const boards = new Map<
    number,
    { milestone: MilestoneRef; entries: readonly Entry[] }
  >();
  const dirtyBoards = new Set<number>();
  /** Questions as the monitor last told us, plus our own asks. */
  const questions = new Map<string, { answer: string | null }>();
  /** Asks and resolves the monitor may not have yet; re-sent on every reconnect. */
  const asks = new Map<string, Ask>();
  const resolves = new Set<string>();
  let stored: { boards: readonly Board[] } = { boards: [] };
  let socket: SocketLike | null = null;
  let closed = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let wake: (() => void) | null = null;
  let welcomed: () => void = () => {};
  const ready = new Promise<void>((resolve) => (welcomed = resolve));

  const send = (msg: AgentMessage): void => {
    if (socket?.readyState === OPEN) socket.send(JSON.stringify(msg));
  };

  const flush = (): void => {
    flushTimer = null;
    if (socket?.readyState !== OPEN) return;
    if (statusDirty) {
      send({ type: "status", status, paused });
      statusDirty = false;
    }
    for (const id of dirtyBoards) {
      const b = boards.get(id);
      if (b) send({ type: "progress", ...b });
    }
    dirtyBoards.clear();
    if (queue.length) {
      send({ type: "log", lines: queue });
      queue = [];
    }
  };

  const schedule = (): void => {
    if (flushTimer === null) flushTimer = setTimeout(flush, FLUSH_MS);
  };

  const notify = (): void => {
    const w = wake;
    wake = null;
    w?.();
  };

  const receive = (msg: ServerMessage): void => {
    switch (msg.type) {
      case "welcome":
        for (const q of msg.questions)
          questions.set(q.id, { answer: q.answer });
        stored = { boards: msg.boards };
        welcomed();
        notify();
        return;
      case "answer":
        questions.set(msg.questionId, { answer: msg.text });
        push([{ t: now(), kind: "loop", text: "--- answer received" }]);
        notify();
        return;
      case "control":
        paused = msg.action === "pause";
        statusDirty = true;
        push([
          {
            t: now(),
            kind: "loop",
            text: paused
              ? "--- pause requested: no new session starts until resumed"
              : "--- resume requested",
          },
        ]);
        notify();
        return;
      case "input":
        push([{ t: now(), kind: "input", text: `✉ ${msg.text}` }]);
        opts.onInput?.(msg.text);
        return;
    }
  };

  const connect = (): void => {
    retryTimer = null;
    let ws: SocketLike;
    try {
      ws = open(url);
    } catch {
      retry();
      return;
    }
    socket = ws;
    ws.onopen = () => {
      send({
        type: "hello",
        instance: opts.instance,
        ...(opts.token ? { token: opts.token } : {}),
      });
      for (const questionId of resolves) send({ type: "resolved", questionId });
      for (const question of asks.values()) send({ type: "ask", question });
      statusDirty = true;
      for (const id of boards.keys()) dirtyBoards.add(id);
      flush();
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      receive(msg);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (socket === ws) socket = null;
      retry();
    };
  };

  const retry = (): void => {
    if (!closed && retryTimer === null)
      retryTimer = setTimeout(connect, RECONNECT_MS);
  };

  const push = (lines: LogLine[]): void => {
    if (closed || lines.length === 0) return;
    queue.push(...lines);
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    schedule();
  };

  connect();

  return {
    ready,
    loop: (text) => push([{ t: now(), kind: "loop", text }]),
    stream: (raw, issue) => push(streamLines(raw, issue, now())),
    status: (s) => {
      status = s;
      statusDirty = true;
      schedule();
    },
    stored: (m) =>
      stored.boards.find((b) => b.milestone.id === m.id)?.entries ?? [],
    save: (milestone, entries) => {
      boards.set(milestone.id, { milestone, entries: [...entries] });
      dirtyBoards.add(milestone.id);
      schedule();
    },
    ask: (milestone, issue, text) => {
      const question: Ask = {
        id: newId(),
        milestone,
        issue: issue.number,
        title: issue.title,
        text,
      };
      asks.set(question.id, question);
      questions.set(question.id, { answer: null });
      send({ type: "ask", question });
      return question.id;
    },
    question: (id) => questions.get(id) ?? null,
    resolve: (id) => {
      asks.delete(id);
      questions.delete(id);
      resolves.add(id);
      send({ type: "resolved", questionId: id });
    },
    paused: () => paused,
    wait: (ms) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          wake = null;
          resolve();
        }, ms);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      }),
    close: async () => {
      if (flushTimer !== null) clearTimeout(flushTimer);
      if (retryTimer !== null) clearTimeout(retryTimer);
      flush();
      closed = true;
      notify();
      const ws = socket;
      if (!ws) return;
      const deadline = now() + CLOSE_WAIT_MS;
      while (
        ws.readyState === OPEN &&
        ws.bufferedAmount > 0 &&
        now() < deadline
      )
        await new Promise((r) => setTimeout(r, 50));
      ws.onclose = null;
      ws.close();
    },
  };
}

const MAX_INPUT = 300;
const MAX_OUTPUT_LINES = 12;
const MAX_OUTPUT_CHARS = 2000;
/** JSON output is kept whole (the monitor renders it), so it gets a bigger budget. */
const MAX_JSON_CHARS = 12_000;
const MAX_JSON_ITEMS = 50;

/** Turn one stream-json line into the monitor's coloured log lines. */
export function streamLines(raw: string, issue: number, t: number): LogLine[] {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return raw.trim() ? [{ t, issue, kind: "system", text: raw.trim() }] : [];
  }
  const rec = asRecord(msg);
  const line = (
    kind: LogKind,
    text: string,
    extra: { call?: string; detail?: LogDetail | undefined } = {},
  ): LogLine => ({
    t,
    issue,
    kind,
    text,
    ...(extra.call ? { call: extra.call } : {}),
    ...(extra.detail ? { detail: extra.detail } : {}),
  });
  switch (rec.type) {
    case "system":
      return rec.subtype === "init"
        ? [
            line(
              "system",
              `session ${str(rec.session_id).slice(0, 8)} started · ${str(rec.model)}`,
            ),
          ]
        : [];
    case "assistant":
      return blocks(rec.message).flatMap((b): LogLine[] => {
        if (b.type === "text" && str(b.text).trim())
          return [line("text", str(b.text).trim())];
        if (b.type === "thinking" && str(b.thinking).trim())
          return [line("thinking", str(b.thinking).trim())];
        if (b.type === "tool_use")
          return [
            line("tool", `→ ${str(b.name)}  ${toolInput(b.input)}`, {
              call: str(b.id),
              detail: commandDetail(str(b.name), b.input),
            }),
          ];
        return [];
      });
    case "user": {
      const results = blocks(rec.message).filter(
        (b) => b.type === "tool_result",
      );
      // `tool_use_result` is per record, so it only describes a lone result.
      const patch =
        results.length === 1 ? patchDetail(rec.tool_use_result) : undefined;
      return results.map((b) =>
        line(b.is_error === true ? "error" : "output", toolOutput(b.content), {
          call: str(b.tool_use_id),
          detail: patch,
        }),
      );
    }
    case "result": {
      const parts = [
        rec.is_error === true ? "session failed" : "session done",
        typeof rec.num_turns === "number"
          ? `${String(rec.num_turns)} turns`
          : "",
        typeof rec.duration_ms === "number"
          ? `${String(Math.round(rec.duration_ms / 1000))}s`
          : "",
        typeof rec.total_cost_usd === "number"
          ? `$${rec.total_cost_usd.toFixed(2)}`
          : "",
      ].filter(Boolean);
      return [
        line(rec.is_error === true ? "error" : "result", parts.join(" · ")),
      ];
    }
    case "rate_limit_event":
      return str(asRecord(rec.rate_limit_info).status) === "rejected"
        ? [line("error", "usage limit reached")]
        : [];
    default:
      return [];
  }
}

function toolInput(input: unknown): string {
  const rec = asRecord(input);
  const pick =
    str(rec.command) ||
    str(rec.file_path) ||
    str(rec.notebook_path) ||
    str(rec.pattern) ||
    str(rec.url) ||
    str(rec.query) ||
    str(rec.description) ||
    str(rec.skill) ||
    (input === undefined ? "" : JSON.stringify(input));
  return clip(pick.replace(/\s*\n\s*/g, " ⏎ "), MAX_INPUT);
}

const MAX_COMMAND = 8000;
const MAX_PATCH_LINES = 400;
const MAX_PATCH_LINE = 500;

function commandDetail(name: string, input: unknown): LogDetail | undefined {
  const command = str(asRecord(input).command);
  return name === "Bash" && command
    ? { type: "command", command: clip(command, MAX_COMMAND) }
    : undefined;
}

/**
 * The diff behind an Edit/Write result, from the `tool_use_result` Claude Code
 * puts beside it in stream-json: `structuredPatch` hunks for a change, or the
 * whole `content` of a `create`. Hunks are kept until {@link MAX_PATCH_LINES}.
 */
function patchDetail(result: unknown): LogDetail | undefined {
  const rec = asRecord(result);
  const file = str(rec.filePath);
  if (!file) return undefined;
  const hunks =
    rec.type === "create" && typeof rec.content === "string"
      ? [
          {
            oldStart: 0,
            newStart: 1,
            lines: rec.content
              .replace(/\n$/, "")
              .split("\n")
              .map((l) => `+${l}`),
          },
        ]
      : Array.isArray(rec.structuredPatch)
        ? (rec.structuredPatch as unknown[]).map(asRecord).map((h) => ({
            oldStart: typeof h.oldStart === "number" ? h.oldStart : 0,
            newStart: typeof h.newStart === "number" ? h.newStart : 0,
            lines: Array.isArray(h.lines)
              ? (h.lines as unknown[]).filter(
                  (l): l is string => typeof l === "string",
                )
              : [],
          }))
        : undefined;
  if (!hunks?.length) return undefined;
  let budget = MAX_PATCH_LINES;
  let omitted = 0;
  const kept = hunks.flatMap((h) => {
    const lines = h.lines.slice(0, Math.max(budget, 0));
    omitted += h.lines.length - lines.length;
    budget -= lines.length;
    return lines.length
      ? [{ ...h, lines: lines.map((l) => clip(l, MAX_PATCH_LINE)) }]
      : [];
  });
  return { type: "patch", file, hunks: kept, omitted };
}

function toolOutput(content: unknown): string {
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? (content as unknown[])
            .map((c) => str(asRecord(c).text))
            .filter(Boolean)
            .join("\n")
        : "";
  if (!text.trim()) return "(no output)";
  const json = compactJson(text);
  if (json !== undefined) return json;
  const lines = text.trimEnd().split("\n");
  const shown = lines.slice(0, MAX_OUTPUT_LINES).join("\n");
  const more = lines.length - MAX_OUTPUT_LINES;
  return (
    clip(shown, MAX_OUTPUT_CHARS) +
    (more > 0 ? `\n… ${String(more)} more lines` : "")
  );
}

/**
 * Re-serialise an object/array tool result to fit {@link MAX_JSON_CHARS} while
 * staying valid JSON — clipping its strings and arrays rather than its tail — so
 * the monitor can still parse and render it. `undefined` when it is not JSON.
 */
function compactJson(text: string): string | undefined {
  const head = text.trimStart()[0];
  if (head !== "{" && head !== "[") return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  for (let max = 4000; ; max = Math.floor(max / 2)) {
    const out = JSON.stringify(shrink(value, max));
    if (out.length <= MAX_JSON_CHARS || max < 40) return out;
  }
}

function shrink(value: unknown, maxString: number): unknown {
  if (typeof value === "string") return clip(value, maxString);
  if (Array.isArray(value)) {
    const kept = (value as unknown[])
      .slice(0, MAX_JSON_ITEMS)
      .map((v) => shrink(v, maxString));
    const more = value.length - kept.length;
    return more > 0 ? [...kept, `… ${String(more)} more items`] : kept;
  }
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, shrink(v, maxString)]),
    );
  return value;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object"
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function blocks(message: unknown): Record<string, unknown>[] {
  const content = asRecord(message).content;
  return Array.isArray(content) ? (content as unknown[]).map(asRecord) : [];
}
