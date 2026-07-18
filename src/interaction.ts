import type { LocalContext } from "./context.js";

/**
 * Resolve whether a command may prompt. Interactive by default, but forced off
 * when the user asked (`--no-interaction` → `interaction === false`), when an
 * escape-hatch env var is set, in CI, or when stdin/stdout is not a TTY (piped
 * or redirected — the "detect based on shell" behaviour).
 */
export function resolveInteractive(
  ctx: LocalContext,
  interactionFlag: boolean,
): boolean {
  if (!interactionFlag) return false;
  if (ctx.process.env.JARRIN_NO_INTERACTION) return false;
  if (ctx.process.env.CI) return false;
  if (!ctx.process.stdin.isTTY || !ctx.process.stdout.isTTY) return false;
  return true;
}

/** Thrown to abort a command cleanly (e.g. the user cancelled a prompt). */
export class AbortError extends Error {
  constructor(message = "Cancelled.") {
    super(message);
    this.name = "AbortError";
  }
}

/** Thrown when a required value is missing in non-interactive mode. */
export class MissingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingInputError";
  }
}

/**
 * Lazily loaded `@clack/prompts`. Keeping it behind a dynamic import means the
 * hot `session-start` hook path never parses the interactive UI library.
 */
export async function loadPrompts(): Promise<typeof import("@clack/prompts")> {
  return import("@clack/prompts");
}
