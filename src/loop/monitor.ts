import { AGENT_PATH } from "../../monitor/shared/protocol.js";
import { trustSystemCAs } from "./trust.js";
import type {
  AgentMessage,
  InstanceInfo,
  LogKind,
  LogLine,
} from "../../monitor/shared/protocol.js";

/**
 * Live feed of a running loop to the claudjar monitor (`monitor/` in this repo,
 * served at e.g. wss://claudjar.jarrin.nl). Strictly best-effort: the loop never
 * waits on it or fails because of it. Lines queue while the socket is down and
 * flush on reconnect; the same instance id keeps the same tab across reconnects.
 */
export interface Monitor {
  /** One of the loop's own progress lines. */
  loop(text: string): void;
  /** One raw stream-json line from the session working `issue`. */
  stream(raw: string, issue: number): void;
  status(status: string): void;
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
  send(data: string): void;
  close(): void;
}

export interface MonitorOptions {
  readonly url: string;
  readonly token: string;
  readonly instance: InstanceInfo;
  readonly open?: (url: string) => SocketLike;
  readonly now?: () => number;
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

export function connectMonitor(opts: MonitorOptions): Monitor {
  const now = opts.now ?? Date.now;
  const open =
    opts.open ??
    ((url: string): SocketLike => {
      trustSystemCAs();
      return new WebSocket(url);
    });
  const url = agentUrl(opts.url);
  let queue: LogLine[] = [];
  let status: string | null = null;
  let socket: SocketLike | null = null;
  let closed = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const send = (msg: AgentMessage): void => socket?.send(JSON.stringify(msg));

  const flush = (): void => {
    flushTimer = null;
    if (socket?.readyState !== OPEN) return;
    if (status !== null) {
      send({ type: "status", status });
      status = null;
    }
    if (queue.length) {
      send({ type: "log", lines: queue });
      queue = [];
    }
  };

  const schedule = (): void => {
    if (flushTimer === null) flushTimer = setTimeout(flush, FLUSH_MS);
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
      flush();
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
    loop: (text) => push([{ t: now(), kind: "loop", text }]),
    stream: (raw, issue) => push(streamLines(raw, issue, now())),
    status: (s) => {
      status = s;
      schedule();
    },
    close: async () => {
      if (flushTimer !== null) clearTimeout(flushTimer);
      if (retryTimer !== null) clearTimeout(retryTimer);
      flush();
      closed = true;
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

/** Turn one stream-json line into the monitor's coloured log lines. */
export function streamLines(raw: string, issue: number, t: number): LogLine[] {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return raw.trim() ? [{ t, issue, kind: "system", text: raw.trim() }] : [];
  }
  const rec = asRecord(msg);
  const line = (kind: LogKind, text: string): LogLine => ({
    t,
    issue,
    kind,
    text,
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
          return [line("tool", `→ ${str(b.name)}  ${toolInput(b.input)}`)];
        return [];
      });
    case "user":
      return blocks(rec.message).flatMap((b): LogLine[] =>
        b.type === "tool_result"
          ? [
              line(
                b.is_error === true ? "error" : "output",
                toolOutput(b.content),
              ),
            ]
          : [],
      );
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
  const lines = text.trimEnd().split("\n");
  const shown = lines.slice(0, MAX_OUTPUT_LINES).join("\n");
  const more = lines.length - MAX_OUTPUT_LINES;
  return (
    clip(shown, MAX_OUTPUT_CHARS) +
    (more > 0 ? `\n… ${String(more)} more lines` : "")
  );
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
