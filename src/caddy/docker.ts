import { spawnSync } from "node:child_process";

import {
  CADDY_CONTAINER,
  CADDY_HOST_PORT,
  CADDY_IMAGE,
  CADDY_NETWORK,
} from "./route.js";

/**
 * Lifecycle of the single machine-wide caddy container claudjar owns.
 *
 * Only this container and the `claudjar` network are managed here. Project
 * containers are never created, inspected, or stopped — a project's stack is its
 * own business, and claudjar's caddy simply 502s until the project brings its
 * caddy up on the shared network. That is the correct failure: the two sides are
 * deliberately decoupled, so neither has to be running for the other to start.
 */

export interface DockerResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Run `docker` with captured output. A missing docker binary reads as status 1. */
export function docker(args: readonly string[]): DockerResult {
  const res = spawnSync("docker", [...args], { encoding: "utf8" });
  if (res.error) {
    return { status: 1, stdout: "", stderr: res.error.message };
  }
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

/** Whether the docker CLI is reachable at all — the first thing to report. */
export function dockerAvailable(): boolean {
  return docker(["version", "--format", "{{.Server.Version}}"]).status === 0;
}

/** Create the shared network if it does not exist. Idempotent. */
export function ensureNetwork(): DockerResult | null {
  if (docker(["network", "inspect", CADDY_NETWORK]).status === 0) return null;
  return docker(["network", "create", CADDY_NETWORK]);
}

export type ContainerState = "running" | "stopped" | "absent";

export function containerState(): ContainerState {
  const res = docker(["inspect", "-f", "{{.State.Running}}", CADDY_CONTAINER]);
  if (res.status !== 0) return "absent";
  return res.stdout.trim() === "true" ? "running" : "stopped";
}

/**
 * Bring the container up against `caddyfile`, mounted read-only so a container
 * restart can never rewrite the file claudjar generates.
 *
 * A stopped-but-present container is removed rather than started: its bind mount
 * and published port were fixed at creation, so restarting one created against a
 * stale path would silently serve the wrong config.
 */
export function caddyUp(caddyfile: string): DockerResult {
  const state = containerState();
  // Already up: a reload is the honest meaning of `up` here. reloadCaddy() only
  // returns null when nothing is running, which this branch has ruled out.
  if (state === "running") {
    return reloadCaddy() ?? { status: 0, stdout: "", stderr: "" };
  }
  if (state === "stopped") docker(["rm", "-f", CADDY_CONTAINER]);

  return docker([
    "run",
    "-d",
    "--name",
    CADDY_CONTAINER,
    "--network",
    CADDY_NETWORK,
    // Clear the inherited DNS search domains. Without this, an upstream that is
    // simply not running does not fail: Docker's embedded DNS falls through to
    // the host resolver, which appends the machine's search domain and can
    // resolve `caddy-<slug>` to a real EXTERNAL host — quietly proxying a
    // request meant for a local project off the machine. Observed live, against
    // a production server. With no search domain the single label either
    // resolves to a container on this network or fails, which is a 502.
    "--dns-search",
    ".",
    "--restart",
    "unless-stopped",
    "-p",
    `${String(CADDY_HOST_PORT)}:80`,
    "-v",
    `${caddyfile}:/etc/caddy/Caddyfile:ro`,
    "-v",
    "claudjar-caddy-data:/data",
    CADDY_IMAGE,
  ]);
}

export function caddyDown(): DockerResult | null {
  if (containerState() === "absent") return null;
  return docker(["rm", "-f", CADDY_CONTAINER]);
}

/**
 * Reload the running container's config in place.
 *
 * Returns null when nothing is running — regenerating routes for a caddy that is
 * down is a no-op, not a failure, so `join` in a repo works before `caddy up` has
 * ever been run on the machine and the routes are simply picked up later.
 */
export function reloadCaddy(): DockerResult | null {
  if (containerState() !== "running") return null;
  return docker([
    "exec",
    CADDY_CONTAINER,
    "caddy",
    "reload",
    "--config",
    "/etc/caddy/Caddyfile",
    "--adapter",
    "caddyfile",
  ]);
}
