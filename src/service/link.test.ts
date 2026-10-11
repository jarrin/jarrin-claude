import { describe, expect, it, vi } from "vitest";

import type {
  HostMessage,
  ProjectInfo,
  ServerHostMessage,
} from "../../monitor/shared/protocol.js";
import type { SocketLike } from "../loop/monitor.js";
import { connectHost, hostUrl } from "./link.js";
import type { HostLinkOptions } from "./link.js";

class FakeSocket implements SocketLike {
  readyState = 0;
  bufferedAmount = 0;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  sent: HostMessage[] = [];
  closed = false;
  send(data: string): void {
    this.sent.push(JSON.parse(data) as HostMessage);
  }
  close(): void {
    this.closed = true;
    this.readyState = 3;
  }
  accept(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  receive(msg: ServerHostMessage): void {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(msg) }),
    );
  }
  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  }
}

const proj = (name: string, active = false): ProjectInfo => ({
  name,
  path: `/p/${name}`,
  configured: true,
  backlogRepo: "",
  active,
});

function setup(over: Partial<HostLinkOptions> = {}) {
  const sockets: FakeSocket[] = [];
  const logs: string[] = [];
  let projects: ProjectInfo[] = [proj("a")];
  const link = connectHost({
    url: "wss://m.example",
    token: "tok",
    host: { host: "desk", pid: 1, startedAt: 0 },
    projects: () => projects,
    onCommand: () => Promise.resolve({ ok: true }),
    log: (l) => logs.push(l),
    reconnectMs: 10,
    open: (url) => {
      expect(url).toBe("wss://m.example/ws/host");
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    ...over,
  });
  const set = (p: ProjectInfo[]): void => {
    projects = p;
  };
  return { link, sockets, logs, set };
}

describe("hostUrl", () => {
  it("adds /ws/host to a bare base and keeps an explicit path", () => {
    expect(hostUrl("wss://claudjar.jarrin.nl")).toBe(
      "wss://claudjar.jarrin.nl/ws/host",
    );
    expect(hostUrl("ws://localhost:3000/custom")).toBe(
      "ws://localhost:3000/custom",
    );
  });
});

describe("connectHost", () => {
  it("says hello with the token and the current projects", () => {
    const { sockets } = setup();
    sockets[0]?.accept();
    expect(sockets[0]?.sent).toEqual([
      {
        type: "host-hello",
        host: { host: "desk", pid: 1, startedAt: 0 },
        token: "tok",
        projects: [proj("a")],
      },
    ]);
  });

  it("publishes only a changed project list", () => {
    const { link, sockets } = setup();
    const s = sockets[0];
    s?.accept();
    link.publish([proj("a")]);
    expect(s?.sent).toHaveLength(1);
    link.publish([proj("a"), proj("b")]);
    expect(s?.sent.at(-1)).toEqual({
      type: "projects",
      projects: [proj("a"), proj("b")],
    });
    link.publish([proj("a"), proj("b")]);
    expect(s?.sent).toHaveLength(2);
  });

  it("loses nothing while down: the reconnect hello carries the latest projects", async () => {
    vi.useFakeTimers();
    try {
      const { link, sockets, set } = setup();
      sockets[0]?.accept();
      sockets[0]?.drop();
      set([proj("a", true), proj("b")]);
      link.publish([proj("a", true), proj("b")]);
      link.projectState(proj("a", true));
      await vi.advanceTimersByTimeAsync(10);
      const again = sockets[1];
      again?.accept();
      expect(again?.sent).toEqual([
        expect.objectContaining({
          type: "host-hello",
          projects: [proj("a", true), proj("b")],
        }),
      ]);
      // And the list it carried is not re-sent by the next scan.
      link.publish([proj("a", true), proj("b")]);
      expect(again?.sent).toHaveLength(1);
      link.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs a command and answers with its id", async () => {
    const onCommand = vi.fn(() =>
      Promise.resolve({ ok: false as const, error: "nope" }),
    );
    const { sockets } = setup({ onCommand });
    const s = sockets[0];
    s?.accept();
    s?.receive({
      type: "command",
      id: "c1",
      command: { type: "open-project", project: "a" },
    });
    await vi.waitFor(() =>
      expect(s?.sent.at(-1)).toEqual({
        type: "command-result",
        result: { id: "c1", ok: false, error: "nope" },
      }),
    );
    expect(onCommand).toHaveBeenCalledWith({
      type: "open-project",
      project: "a",
    });
  });

  it("turns a throwing handler into a failed result", async () => {
    const { sockets } = setup({
      onCommand: () => Promise.reject(new Error("boom")),
    });
    const s = sockets[0];
    s?.accept();
    s?.receive({
      type: "command",
      id: "c2",
      command: { type: "close-project", project: "a" },
    });
    await vi.waitFor(() =>
      expect(s?.sent.at(-1)).toEqual({
        type: "command-result",
        result: { id: "c2", ok: false, error: "boom" },
      }),
    );
  });

  it("logs a rejected token once, however often it retries", async () => {
    vi.useFakeTimers();
    try {
      const { link, sockets, logs } = setup();
      for (let i = 0; i < 3; i++) {
        sockets[i]?.accept();
        sockets[i]?.drop(4401);
        await vi.advanceTimersByTimeAsync(10);
      }
      expect(logs.filter((l) => l.includes("rejected the token"))).toHaveLength(
        1,
      );
      link.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops reconnecting once closed", async () => {
    vi.useFakeTimers();
    try {
      const { link, sockets } = setup();
      sockets[0]?.accept();
      link.close();
      expect(sockets[0]?.closed).toBe(true);
      await vi.advanceTimersByTimeAsync(100);
      expect(sockets).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
