#!/usr/bin/env node
/**
 * `pnpm run ensurepath` — make the `claudjar` command resolvable on PATH.
 *
 * The work of linking lives in `claudjar install`, so this script's only real
 * job is the bootstrap problem that `install` cannot solve for itself: on a
 * fresh clone there is no bundle to run `install` *from*. So it checks for a
 * build first and offers to produce one, then hands over.
 *
 * Kept as a plain node script (not a claudjar subcommand) for that same reason —
 * it has to work when nothing is built yet.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(repoRoot, "dist", "claudjar.cjs");
const binary = join(repoRoot, "dist", "build", "claudjar");

/** Ask a yes/no question; defaults to yes, and assumes yes when not a TTY. */
async function confirm(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [Y/n] `))
      .trim()
      .toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function run(command, args) {
  const res = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  return res.status === 0;
}

const missing = [];
if (!existsSync(bundle)) missing.push("dist/claudjar.cjs");
if (!existsSync(binary)) missing.push("dist/build/claudjar");

if (missing.length > 0) {
  console.log(`ensurepath: not built yet (missing ${missing.join(", ")}).`);
  if (!(await confirm("Build it now?"))) {
    console.error("ensurepath: nothing to link without a build; aborting.");
    process.exit(1);
  }
  if (!run("pnpm", ["run", "build"])) {
    console.error("ensurepath: build failed.");
    process.exit(1);
  }
}

// Hand over to install, which owns the symlinks, the ~/.claude config, and the
// "is this dir actually on PATH?" check.
if (!run(process.execPath, [bundle, "install"])) {
  process.exit(1);
}
