import { buildApplication, buildRouteMap, run } from "@stricli/core";

import { infoCommand } from "./commands/info.js";
import { initCommand } from "./commands/init.js";
import { installCommand } from "./commands/install.js";
import { sessionEndCommand } from "./commands/session-end.js";
import { sessionStartCommand } from "./commands/session-start.js";
import { startCommand, stopCommand } from "./commands/start.js";
import { statuslineCommand } from "./commands/statusline.js";
import { worktreeRoutes } from "./commands/worktree.js";
import { buildContext } from "./context.js";

const VERSION = "0.1.0";

const routes = buildRouteMap({
  routes: {
    init: initCommand,
    info: infoCommand,
    install: installCommand,
    worktree: worktreeRoutes,
    start: startCommand,
    stop: stopCommand,
    "session-start": sessionStartCommand,
    "session-end": sessionEndCommand,
    statusline: statuslineCommand,
  },
  docs: {
    brief: "Manage Jarrin's Claude Code config",
    fullDescription:
      "claudjar — set up a repo's .claude/.jarrin.yml, install the config into " +
      "~/.claude, and back the SessionStart rule-loading hook.",
  },
});

const app = buildApplication(routes, {
  name: "claudjar",
  versionInfo: { currentVersion: VERSION },
  scanner: { caseStyle: "allow-kebab-for-camel" },
});

await run(app, process.argv.slice(2), buildContext(process));
