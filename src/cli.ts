import { run } from "@stricli/core";

import { buildContext } from "./context.js";
import { buildApp } from "./routes.js";

// The real application hides the internal `api` routes; `help --full
// --include-internal` builds its own fully-visible copy from the same factory.
//
// Invoked through a `void`-ed promise rather than top-level await: the shipped
// artifact is a CommonJS bundle (Node's SEA loader runs an embedded main as CJS,
// never as ESM), and top-level await cannot be expressed in CJS. The source
// stays plain ESM so `tsx src/cli.ts` keeps working in dev.
void run(buildApp(true), process.argv.slice(2), buildContext(process));
