import { defineConfig } from "tsup";

// Single self-contained bundle. The hook and installer are invoked by absolute
// path (through symlinks into ~/.claude/bin), so a one-file bundle sidesteps
// node_modules resolution relative to the real file. `dist/` is committed so a
// fresh clone can run `node dist/claudjar.js install` with zero prior install.
export default defineConfig({
  entry: { claudjar: "src/cli.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  noExternal: [/.*/],
  splitting: false,
  clean: true,
  minify: false,
  sourcemap: false,
  dts: false,
  // Shebang + a real `require` for the ESM bundle: some CJS deps (yaml) call
  // require() internally, which an ESM output cannot provide on its own.
  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
});
