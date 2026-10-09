/**
 * Notes the user sends a loop from the monitor. While a session runs they go
 * straight into it (Claude Code takes a user message mid-turn); while none does
 * they wait here and open the next session's prompt instead.
 */
export class InputBox {
  private pending: string[] = [];
  private sink: ((text: string) => void) | null = null;

  push(text: string): void {
    if (this.sink) this.sink(text);
    else this.pending.push(text);
  }

  /** A session starts: route new input to `sink`; returns what was waiting for it. */
  attach(sink: (text: string) => void): string[] {
    this.sink = sink;
    return this.pending.splice(0);
  }

  /** The session can take no more input; hold it for the next one. */
  detach(): void {
    this.sink = null;
  }
}

/** One user turn in Claude Code's `--input-format stream-json`. */
export function userMessage(text: string): string {
  return `${JSON.stringify({
    type: "user",
    message: { role: "user", content: text },
  })}\n`;
}

/** The prompt, followed by notes that arrived while no session was running. */
export function withNotes(prompt: string, notes: readonly string[]): string {
  if (notes.length === 0) return prompt;
  return [
    prompt,
    "",
    "Notes the user sent for this session:",
    ...notes.map((n) => n.replace(/^/gm, "> ")),
  ].join("\n");
}
