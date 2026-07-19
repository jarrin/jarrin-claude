import { run } from "@stricli/core";

import { buildContext } from "./context.js";
import { buildApp } from "./routes.js";

// The real application hides the internal `api` routes; `help --full
// --include-internal` builds its own fully-visible copy from the same factory.
await run(buildApp(true), process.argv.slice(2), buildContext(process));
