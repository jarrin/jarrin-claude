import { createConnection } from "node:net";

/** Loopback host the probe dials — a project stack always binds locally. */
const HOST = "127.0.0.1";

/**
 * How long to wait for a TCP connect before calling the port down. Deliberately
 * short: this runs on the statusline's render path, which Claude Code re-invokes
 * on every conversation update. On loopback a listening socket accepts in well
 * under a millisecond and a closed one refuses immediately (ECONNREFUSED), so the
 * timeout only bites on a filtered/blackholed port — rare enough not to warrant a
 * cache layer.
 */
const TIMEOUT_MS = 50;

/**
 * Is something listening on `port` on loopback? Resolves `true` on a completed
 * TCP connect, `false` on refusal, error, or timeout — never rejects, because a
 * statusline must render regardless.
 */
export function probePort(
  port: number,
  timeoutMs: number = TIMEOUT_MS,
): Promise<boolean> {
  if (port <= 0) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ port, host: HOST });
    let settled = false;
    const finish = (up: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(up);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finish(true);
    });
    socket.once("timeout", () => {
      finish(false);
    });
    socket.once("error", () => {
      finish(false);
    });
  });
}
