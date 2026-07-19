#!/usr/bin/env node
/**
 * Assemble the standalone `claudjar` executable from the bundled CJS output.
 *
 * This is Node's Single Executable Application flow, which is three steps
 * masquerading as one:
 *
 *   1. `node --experimental-sea-config` packs the entry script into a blob.
 *   2. The running node binary is copied to become the shell of the executable.
 *   3. `postject` injects the blob into that copy, against a sentinel fuse the
 *      node runtime looks for at startup to decide "am I a SEA?".
 *
 * Two constraints shape everything upstream of this script. The embedded main is
 * executed by the **CommonJS** loader — an ESM entry fails with "Cannot use
 * import statement outside a module" — which is why tsup emits CJS. And the blob
 * carries the script only, not `node_modules`, which is why the bundle inlines
 * every dependency.
 *
 * The result is ~110 MB because it contains a whole Node runtime. That is the
 * deal with SEA; `dist/` is gitignored, so it costs disk, not repository weight.
 */
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(repoRoot, "dist");
const buildDir = join(distDir, "build");
const entry = join(distDir, "claudjar.cjs");
const blob = join(distDir, "claudjar.blob");
const seaConfig = join(distDir, "sea-config.json");
const output = join(buildDir, "claudjar");

/** The fuse string Node's SEA loader scans its own binary for. */
const SENTINEL = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function run(command, args, label) {
  const res = spawnSync(command, args, { stdio: "inherit", cwd: repoRoot });
  if (res.error) {
    console.error(`build-binary: ${label} could not run: ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`build-binary: ${label} failed (exit ${res.status}).`);
    process.exit(res.status ?? 1);
  }
}

if (!existsSync(entry)) {
  console.error(
    `build-binary: ${entry} is missing — run the bundle step (tsup) first.`,
  );
  process.exit(1);
}

mkdirSync(buildDir, { recursive: true });

// 1. Pack the entry script into a SEA blob. `useSnapshot` stays off: snapshots
//    forbid a top-level `require` of some built-ins, which the bundle does.
const config = {
  main: entry,
  output: blob,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
};
const { writeFileSync } = await import("node:fs");
writeFileSync(seaConfig, JSON.stringify(config, null, 2));
run(process.execPath, ["--experimental-sea-config", seaConfig], "sea-config");

// 2. Copy the running node binary to become the executable's shell. Removing any
//    previous output first matters: postject rewrites the file in place, and
//    injecting twice into an already-injected binary is not idempotent.
rmSync(output, { force: true });
copyFileSync(process.execPath, output);
chmodSync(output, 0o755);

// 3. Inject the blob. postject is resolved through node so this works regardless
//    of whether node_modules/.bin is on PATH.
run(
  process.execPath,
  [
    join(repoRoot, "node_modules", "postject", "dist", "cli.js"),
    output,
    "NODE_SEA_BLOB",
    blob,
    "--sentinel-fuse",
    SENTINEL,
  ],
  "postject",
);
chmodSync(output, 0o755);

// The intermediates are reproducible from the bundle; keeping them would just
// leave two stale copies of the script lying next to the real artifact.
rmSync(blob, { force: true });
rmSync(seaConfig, { force: true });

console.log(`build-binary: wrote ${output}`);
