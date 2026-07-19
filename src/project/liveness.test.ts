import { createServer } from "node:net";
import type { AddressInfo, Server } from "node:net";

import { describe, expect, it } from "vitest";

import { probePort } from "./liveness.js";

/** Start a loopback listener and resolve the ephemeral port it landed on. */
function listen(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, port });
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => void resolve()));
}

describe("probePort", () => {
  it("reports a listening port as up", async () => {
    const { server, port } = await listen();
    try {
      await expect(probePort(port)).resolves.toBe(true);
    } finally {
      await close(server);
    }
  });

  it("reports a closed port as down", async () => {
    // Bind then release, so the port is known-free rather than merely guessed.
    const { server, port } = await listen();
    await close(server);
    await expect(probePort(port)).resolves.toBe(false);
  });

  it("treats an unassigned port (0) as down without dialling", async () => {
    await expect(probePort(0)).resolves.toBe(false);
  });
});
