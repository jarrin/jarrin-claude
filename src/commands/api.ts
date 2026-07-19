import { buildRouteMap } from "@stricli/core";

import { sessionStartCommand } from "./session-start.js";
import { statuslineCommand } from "./statusline.js";

/**
 * The warning prefix carried by every `api` subcommand's brief. These commands
 * are the machine-facing half of claudjar: Claude Code invokes them through the
 * launchers in `bin/claude/`, passing a JSON payload on stdin and consuming
 * stdout in a fixed format. Running one by hand does nothing useful (it reads a
 * TTY as an empty payload) and is never how a person drives this CLI.
 */
export const INTERNAL_WARNING = "[internal]";

/**
 * `claudjar api` — the internal surface Claude Code itself calls. Hidden from
 * `claudjar --help` (see `hideRoute` in `src/routes.ts`) so the top-level listing
 * shows only commands a person should run; still reachable via `claudjar --helpAll`,
 * `claudjar api --help`, and `claudjar help --full --include-internal`.
 */
export const apiRoutes = buildRouteMap({
  routes: {
    "session-start": sessionStartCommand,
    statusline: statuslineCommand,
  },
  docs: {
    brief: `${INTERNAL_WARNING} Hook entrypoints invoked by Claude Code — not for manual use`,
    fullDescription:
      "INTERNAL — do not run these by hand.\n\n" +
      "These are the entrypoints Claude Code itself invokes, via the thin launchers " +
      "in bin/claude/ (symlinked to ~/.claude/bin/ and registered in " +
      "claude/settings.json). Each one reads a JSON payload on stdin and writes a " +
      "format its caller parses — a hook contract, not a user interface.\n\n" +
      "Run by hand they see an empty payload and fall back to defaults, which is " +
      "harmless but pointless. To drive claudjar as a person, use the top-level " +
      "commands: `claudjar --help`.",
  },
});
