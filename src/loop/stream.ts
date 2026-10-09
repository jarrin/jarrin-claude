/** How one `claude -p --output-format stream-json` run ended, as the loop needs it. */
export interface RunOutcome {
  readonly sessionId: string | null;
  /** True when the run stopped on a usage/rate limit rather than finishing. */
  readonly limited: boolean;
  /** Epoch seconds the limit lifts, when Claude Code reported it. */
  readonly resetsAt: number | null;
  readonly isError: boolean;
  readonly resultText: string;
}

const LIMIT_TEXT = /usage limit|hit your limit|limit reached|rate.?limit/i;
/** The older headless form: `Claude AI usage limit reached|<epoch>`. */
const LIMIT_EPOCH = /limit reached\|(\d{9,13})/i;

/**
 * Folds stream-json lines into a {@link RunOutcome}. `rate_limit_event` carries
 * `rate_limit_info.status` (`allowed` / `allowed_warning` / `rejected`) and
 * `resetsAt` — read off the installed Claude Code 2.1.x bundle, not documented.
 */
export class StreamTracker {
  private sessionId: string | null = null;
  private rejectedResetsAt: number | null = null;
  private sawRejected = false;
  private result: { isError: boolean; text: string } | null = null;

  /** Consume one line; returns a short human-readable progress line, if any. */
  feed(line: string): string | null {
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      return null;
    }
    if (msg === null || typeof msg !== "object") return null;
    const rec = msg as Record<string, unknown>;
    if (typeof rec.session_id === "string") this.sessionId = rec.session_id;

    switch (rec.type) {
      case "rate_limit_event":
        this.onRateLimit(rec.rate_limit_info);
        return null;
      case "result": {
        const text = typeof rec.result === "string" ? rec.result : "";
        this.result = { isError: rec.is_error === true, text };
        return null;
      }
      case "assistant":
        return describeAssistant(rec.message);
      default:
        return null;
    }
  }

  private onRateLimit(info: unknown): void {
    if (info === null || typeof info !== "object") return;
    const rec = info as Record<string, unknown>;
    if (rec.status !== "rejected") return;
    this.sawRejected = true;
    if (typeof rec.resetsAt === "number") {
      this.rejectedResetsAt = toEpochSeconds(rec.resetsAt);
    }
  }

  outcome(exitCode: number | null): RunOutcome {
    const text = this.result?.text ?? "";
    const failed =
      this.result === null || this.result.isError || exitCode !== 0;
    const textEpoch = LIMIT_EPOCH.exec(text);
    const limited =
      failed &&
      (this.sawRejected || LIMIT_TEXT.test(text) || textEpoch !== null);
    return {
      sessionId: this.sessionId,
      limited,
      resetsAt:
        this.rejectedResetsAt ??
        (textEpoch ? toEpochSeconds(Number(textEpoch[1])) : null),
      isError: failed,
      resultText: text,
    };
  }
}

function toEpochSeconds(value: number): number {
  return value > 1e12 ? Math.round(value / 1000) : value;
}

function describeAssistant(message: unknown): string | null {
  if (message === null || typeof message !== "object") return null;
  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content as unknown[]) {
    if (block === null || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
      parts.push(b.text.trim().split("\n")[0] ?? "");
    } else if (b.type === "tool_use" && typeof b.name === "string") {
      parts.push(`→ ${b.name}`);
    }
  }
  return parts.length ? parts.join("  ") : null;
}

/** Margin past the reported reset, so the first retry is not refused at the boundary. */
const RESET_MARGIN_MS = 60_000;
const MIN_WAIT_MS = 60_000;
/** No reset time reported: probe again after this long. */
export const FALLBACK_WAIT_MS = 15 * 60_000;

export function limitWaitMs(resetsAt: number | null, nowMs: number): number {
  if (resetsAt === null) return FALLBACK_WAIT_MS;
  return Math.max(resetsAt * 1000 - nowMs + RESET_MARGIN_MS, MIN_WAIT_MS);
}
