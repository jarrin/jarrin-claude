import { readFileSync } from "node:fs";
import { join } from "node:path";

import { defineConfig } from "tsup";
import { parse } from "yaml";

/**
 * Read this repo's own released version from `project.dist.version` in
 * `.claude/.jarrin.yml` — the same source of truth `claudjar release` writes.
 * Baking it in at build time is what keeps `claudjar --version` honest without
 * keeping a second copy of the number in the source.
 */
function releasedVersion(): string {
  try {
    // Resolved from the working directory, not from this file: tsup loads its
    // config through esbuild as CommonJS, where `import.meta.dirname` is
    // undefined. The build always runs from the repo root (`pnpm run build`).
    const text = readFileSync(
      join(process.cwd(), ".claude", ".jarrin.yml"),
      "utf8",
    );
    const doc: unknown = parse(text);
    const project = pick(doc, "project");
    const dist = pick(project, "dist");
    const version = pick(dist, "version");
    if (version !== undefined && version !== null)
      return String(version).trim();
  } catch {
    /* fall through to the dev placeholder */
  }
  return "0.0.0-dev";
}

function pick(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object") return undefined;
  return (value as Record<string, unknown>)[key];
}

// Single self-contained CommonJS bundle. CJS is not a stylistic preference:
// Node's SEA loader runs an embedded main through the CommonJS loader, so the
// ESM bundle this used to emit fails outright inside the binary ("Cannot use
// import statement outside a module"). Every dependency is inlined because a SEA
// blob carries the script alone — there is no node_modules beside it at runtime.
export default defineConfig({
  entry: { claudjar: "src/cli.ts" },
  format: ["cjs"],
  outExtension: () => ({ js: ".cjs" }),
  target: "node20",
  platform: "node",
  bundle: true,
  noExternal: [/.*/],
  splitting: false,
  clean: true,
  minify: false,
  sourcemap: false,
  dts: false,
  define: {
    __CLAUDJAR_VERSION__: JSON.stringify(releasedVersion()),
  },
  banner: { js: "#!/usr/bin/env node" },
});
