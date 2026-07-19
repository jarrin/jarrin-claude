import { buildApplication, buildRouteMap } from "@stricli/core";
import type { Application, CommandContext } from "@stricli/core";

import { apiRoutes } from "./commands/api.js";
import { caddyRoutes } from "./commands/caddy.js";
import type { LocalContext } from "./context.js";
import { gotoCommand } from "./commands/goto.js";
import { helpCommand } from "./commands/help.js";
import { infoCommand } from "./commands/info.js";
import { initCommand } from "./commands/init.js";
import { installCommand } from "./commands/install.js";
import { releaseCommand } from "./commands/release.js";
import { startCommand, stopCommand } from "./commands/start.js";
import { worktreeRoutes } from "./commands/worktree.js";

/**
 * Replaced at bundle time by tsup's `define`, from `project.dist.version` in
 * this repo's `.claude/.jarrin.yml` — the number `claudjar release` bumps. It is
 * genuinely absent when running from source (`tsx src/cli.ts`), which the
 * `typeof` guard handles: referencing an undeclared identifier directly would
 * throw a ReferenceError, but `typeof` on one is defined to yield "undefined".
 */
declare const __CLAUDJAR_VERSION__: string | undefined;

export const VERSION =
  typeof __CLAUDJAR_VERSION__ === "string" ? __CLAUDJAR_VERSION__ : "0.0.0-dev";

/**
 * Build the CLI's route tree. `hideInternal` controls only whether the `api`
 * route map is marked hidden — the routes themselves are identical either way, so
 * `api` stays runnable regardless and merely disappears from the default help.
 *
 * Two applications are built from this: the real one (internals hidden) and, on
 * demand, a fully-visible one that `help --full --include-internal` walks. Keeping
 * both from a single factory is what stops the two views from drifting apart.
 */
export function buildRoutes(hideInternal: boolean) {
  return buildRouteMap({
    routes: {
      init: initCommand,
      info: infoCommand,
      install: installCommand,
      worktree: worktreeRoutes,
      goto: gotoCommand,
      start: startCommand,
      stop: stopCommand,
      caddy: caddyRoutes,
      release: releaseCommand,
      help: helpCommand,
      api: apiRoutes,
    },
    docs: {
      brief: "Manage Jarrin's Claude Code config",
      fullDescription:
        "claudjar — set up a repo's .claude/.jarrin.yml, install the config into " +
        "~/.claude, manage per-repo worktrees and their project stacks, and back " +
        "the SessionStart hook and statusline.\n\n" +
        "Run `claudjar help --full` to print every command's help at once.",
      hideRoute: { api: hideInternal },
    },
  });
}

/** Build the application. See {@link buildRoutes} for the `hideInternal` split. */
export function buildApp(hideInternal: boolean): Application<LocalContext> {
  return buildApplication(buildRoutes(hideInternal), {
    name: "claudjar",
    versionInfo: { currentVersion: VERSION },
    scanner: { caseStyle: "allow-kebab-for-camel" },
  });
}

/**
 * The same application, narrowed to the context type stricli's documentation
 * helpers accept.
 *
 * `Command<CONTEXT>` is contravariant in its context, so `Application<LocalContext>`
 * is not assignable to `Application<CommandContext>` — a command typed against the
 * richer context cannot be handed the poorer one and then RUN. This cast is sound
 * precisely because `generateHelpTextForAllCommands` never runs anything: it reads
 * briefs, descriptions, and parameter definitions only. Keeping the assertion here,
 * behind a named function, means the unsoundness is stated once instead of being
 * re-argued at each call site.
 */
export function buildDocsApp(
  hideInternal: boolean,
): Application<CommandContext> {
  return buildApp(hideInternal) as unknown as Application<CommandContext>;
}
