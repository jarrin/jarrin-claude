import type { InstanceView, WatchMessage } from "#shared/protocol";

/** Mirrors the server's per-instance cap, so a long-open tab stays bounded. */
export const MAX_VIEW_LINES = 5000;

/** Fold one server message into the instance list (pure, for testing). */
export function applyWatchMessage(
  instances: readonly InstanceView[],
  msg: WatchMessage,
): InstanceView[] {
  switch (msg.type) {
    case "snapshot":
      return [...msg.instances];
    case "instance": {
      const i = instances.findIndex((x) => x.id === msg.instance.id);
      if (i === -1) return [...instances, { ...msg.instance, lines: [] }];
      return instances.map((x, j) =>
        j === i ? { ...x, ...msg.instance, lines: x.lines } : x,
      );
    }
    case "log":
      return instances.map((x) =>
        x.id === msg.id
          ? { ...x, lines: [...x.lines, ...msg.lines].slice(-MAX_VIEW_LINES) }
          : x,
      );
    case "removed":
      return instances.filter((x) => x.id !== msg.id);
  }
}

/** `HH:MM:SS` in the viewer's local time. */
export function clock(t: number): string {
  return new Date(t).toLocaleTimeString("en-GB", { hour12: false });
}
