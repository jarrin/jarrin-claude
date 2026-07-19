import { join } from "node:path";

import { buildCommand, buildRouteMap } from "@stricli/core";

import {
  caddyDown,
  caddyUp,
  containerState,
  dockerAvailable,
  ensureNetwork,
} from "../caddy/docker.js";
import {
  caddyfilePath,
  readRegistry,
  writeRegistry,
} from "../caddy/registry.js";
import { resolveTarget } from "../caddy/resolve.js";
import type { CaddyTarget } from "../caddy/resolve.js";
import {
  CADDY_CONTAINER,
  CADDY_HOST_PORT,
  CADDY_NETWORK,
  PROJECT_CADDY_PORT,
  sortEntries,
} from "../caddy/route.js";
import { deregisterTarget, registerTarget } from "../caddy/sync.js";
import { loadEffectiveConfig } from "../config/load.js";
import type { LocalContext } from "../context.js";
import { toplevel } from "../git.js";

/**
 * `claudjar caddy` — the machine-wide reverse proxy that puts every project on a
 * `<slug>.localhost` domain.
 *
 * claudjar owns exactly one container and one docker network. A project opts in
 * with `caddy.enabled: true` plus a `project.slug`, runs its own caddy on
 * container port 8000 inside its own compose, and joins the `claudjar` network as
 * a second network. claudjar generates only its own config; the project's caddy,
 * compose file, and service routing are never read or written here.
 */

/**
 * Resolve the current repo's caddy identity, or explain why it has none.
 *
 * Shared by `join` and `leave` so both agree on what this checkout is called —
 * a `leave` that resolved differently from the `join` that preceded it would
 * strand a route nothing can remove.
 */
function targetHere(
  ctx: LocalContext,
): { ok: true; target: CaddyTarget } | { ok: false; error: string } {
  const repoRoot = toplevel(ctx.process.cwd());
  if (!repoRoot) return { ok: false, error: "not inside a git repository." };
  const cfg = loadEffectiveConfig(join(repoRoot, ".claude")).merged;
  const target = resolveTarget(cfg, repoRoot);
  if (!target) {
    return {
      ok: false,
      error:
        "no `project.slug` in .claude/.jarrin.yml — a route needs a name.\n" +
        "Add:\n\nproject:\n  slug: my-app\n\ncaddy:\n  enabled: true",
    };
  }
  return { ok: true, target };
}

function runCaddyJoin(this: LocalContext): void {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);
  const fail = (msg: string): void => {
    proc.stderr.write(`caddy join: ${msg}\n`);
    proc.exitCode = 1;
  };

  const resolved = targetHere(this);
  if (!resolved.ok) return fail(resolved.error);
  const { target } = resolved;

  if (!target.enabled) {
    return fail(
      "caddy is not enabled for this repo. Add to .claude/.jarrin.yml:\n\n" +
        "caddy:\n  enabled: true",
    );
  }

  const result = registerTarget(this.caddyDir, target.entry);
  out(
    `Registered ${target.entry.slug}${target.entry.worktree ? ` (${target.entry.worktree})` : ""}.\n`,
  );
  for (const host of target.hosts)
    out(`  http://${host.replace("*.", "<service>.")}\n`);
  out(
    `  → ${target.entry.upstream}:${String(PROJECT_CADDY_PORT)} on network '${CADDY_NETWORK}'\n`,
  );
  reportSync(this, result, out);

  if (containerState() !== "running") {
    out(
      `\nclaudjar's caddy is not running — start it with 'claudjar caddy up'.\n`,
    );
  }
  out(
    `\nThis repo's own caddy must listen on container port ${String(PROJECT_CADDY_PORT)},\n` +
      `answer to the name '${target.entry.upstream}' on the '${CADDY_NETWORK}' network,\n` +
      `and join that network as an external network in its compose file.\n`,
  );
}

function runCaddyLeave(this: LocalContext): void {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);
  const fail = (msg: string): void => {
    proc.stderr.write(`caddy leave: ${msg}\n`);
    proc.exitCode = 1;
  };

  const resolved = targetHere(this);
  if (!resolved.ok) return fail(resolved.error);
  const { entry } = resolved.target;

  const before = readRegistry(this.caddyDir).length;
  const result = deregisterTarget(this.caddyDir, entry.slug, entry.worktree);
  const after = readRegistry(this.caddyDir).length;
  if (before === after) {
    out(`Not registered; nothing to do.\n`);
    return;
  }
  out(
    `Deregistered ${entry.slug}${entry.worktree ? ` (${entry.worktree})` : ""}.\n`,
  );
  reportSync(this, result, out);
}

function runCaddyUp(this: LocalContext): void {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);
  const fail = (msg: string): void => {
    proc.stderr.write(`caddy up: ${msg}\n`);
    proc.exitCode = 1;
  };

  if (!dockerAvailable()) return fail("docker is not available.");

  const netErr = ensureNetwork();
  if (netErr && netErr.status !== 0) {
    return fail(
      `could not create network '${CADDY_NETWORK}': ${netErr.stderr.trim()}`,
    );
  }

  // Regenerate before starting: the container bind-mounts this exact file, so it
  // must exist and be current before docker run, not after.
  const entries = readRegistry(this.caddyDir);
  writeRegistry(this.caddyDir, entries);
  const path = caddyfilePath(this.caddyDir);

  const res = caddyUp(path);
  if (res.status !== 0) {
    return fail((res.stderr || res.stdout).trim() || "`docker run` failed.");
  }
  out(
    `claudjar caddy is up on http://localhost:${String(CADDY_HOST_PORT)} ` +
      `(${String(entries.length)} route(s)).\n`,
  );
  if (entries.length === 0) {
    out(`No projects registered yet — run 'claudjar caddy join' in a repo.\n`);
  }
}

function runCaddyDown(this: LocalContext): void {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);

  const res = caddyDown();
  if (res === null) {
    out(`claudjar caddy is not running.\n`);
    return;
  }
  if (res.status !== 0) {
    proc.stderr.write(
      `caddy down: ${(res.stderr || res.stdout).trim() || "`docker rm` failed."}\n`,
    );
    proc.exitCode = 1;
    return;
  }
  out(`claudjar caddy stopped. Registered routes are kept.\n`);
}

function runCaddyStatus(this: LocalContext): void {
  const proc = this.process;
  const out = (msg: string): void => void proc.stdout.write(msg);

  const state = containerState();
  const mark = state === "running" ? "●" : "○";
  out(`${mark} ${CADDY_CONTAINER}: ${state}`);
  if (state === "running")
    out(` (http://localhost:${String(CADDY_HOST_PORT)})`);
  out("\n");
  out(`  registry: ${join(this.caddyDir, "registry.yml")}\n\n`);

  const entries = sortEntries(readRegistry(this.caddyDir));
  if (entries.length === 0) {
    out("No routes registered. Run 'claudjar caddy join' in a repo.\n");
    return;
  }
  out(`Routes (${String(entries.length)}):\n`);
  for (const entry of entries) {
    const domain = entry.worktree
      ? `${entry.worktree}.${entry.slug}.localhost`
      : `${entry.slug}.localhost`;
    out(
      `  ${domain.padEnd(34)} → ${entry.upstream}:${String(PROJECT_CADDY_PORT)}\n`,
    );
  }
}

/** Report a reload outcome without turning a stopped caddy into a failure. */
function reportSync(
  ctx: LocalContext,
  result: { reloaded: boolean; error: string | null },
  out: (msg: string) => void,
): void {
  if (result.error) {
    ctx.process.stderr.write(`  ! caddy reload failed: ${result.error}\n`);
    ctx.process.exitCode = 1;
    return;
  }
  out(result.reloaded ? "  reloaded claudjar caddy\n" : "");
}

const caddyJoinCommand = buildCommand({
  func: runCaddyJoin,
  parameters: { flags: {} },
  docs: {
    brief: "Register this repo (or worktree) with the machine-wide caddy",
    fullDescription:
      "Read this checkout's project.slug and worktree identity, add a route to " +
      "~/.claudjar/caddy/registry.yml, regenerate the Caddyfile, and reload the " +
      "running caddy.\n\n" +
      "Run once per project. Worktrees register themselves automatically on " +
      "`claudjar worktree create`.\n\n" +
      "claudjar only routes the domain to your project's own caddy container — " +
      "bringing that container up on the shared network, and routing services " +
      "behind it, stays your project's job.",
  },
});

const caddyLeaveCommand = buildCommand({
  func: runCaddyLeave,
  parameters: { flags: {} },
  docs: {
    brief: "Deregister this repo (or worktree) from the machine-wide caddy",
    fullDescription:
      "Remove this checkout's route from the registry, regenerate the Caddyfile, " +
      "and reload. Works even after `caddy.enabled` has been turned off, so a " +
      "repo can always retire its own route.",
  },
});

const caddyUpCommand = buildCommand({
  func: runCaddyUp,
  parameters: { flags: {} },
  docs: {
    brief: `Start the machine-wide caddy on host port ${String(CADDY_HOST_PORT)}`,
    fullDescription:
      `Create the '${CADDY_NETWORK}' docker network if missing, regenerate the ` +
      `Caddyfile from the registry, and run the '${CADDY_CONTAINER}' container ` +
      `publishing host port ${String(CADDY_HOST_PORT)}.\n\n` +
      "Machine-wide, not per-repo: one container serves every registered project. " +
      "Running it when it is already up reloads the config instead.",
  },
});

const caddyDownCommand = buildCommand({
  func: runCaddyDown,
  parameters: { flags: {} },
  docs: {
    brief: "Stop and remove the machine-wide caddy container",
    fullDescription:
      "Removes the container only. The registry survives, so `caddy up` restores " +
      "every route exactly as it was.",
  },
});

const caddyStatusCommand = buildCommand({
  func: runCaddyStatus,
  parameters: { flags: {} },
  docs: {
    brief: "Show the caddy container state and every registered route",
  },
});

export const caddyRoutes = buildRouteMap({
  routes: {
    up: caddyUpCommand,
    down: caddyDownCommand,
    status: caddyStatusCommand,
    join: caddyJoinCommand,
    leave: caddyLeaveCommand,
  },
  docs: {
    brief: "Machine-wide reverse proxy putting projects on <slug>.localhost",
    fullDescription:
      "claudjar runs one caddy on host port " +
      `${String(CADDY_HOST_PORT)}, attached to the '${CADDY_NETWORK}' docker ` +
      "network, and routes:\n\n" +
      "  <service>.<worktree>.<slug>.localhost\n\n" +
      "to each registered project's OWN caddy container on port " +
      `${String(PROJECT_CADDY_PORT)}. The <service> and <worktree> segments are ` +
      "optional: prdl.localhost, studio.prdl.localhost, studio.dev.prdl.localhost.\n\n" +
      "The split is deliberate. claudjar owns its container, its network, and its " +
      "generated config — nothing else. Each project supplies its own caddy, its " +
      `own compose file, and joins '${CADDY_NETWORK}' as an external network; ` +
      "claudjar never reads or writes any of it. The upstream container name is " +
      "therefore a convention, not a setting: caddy-<slug> for a main checkout, " +
      "caddy-<slug>-<worktree> for a worktree.",
  },
});
