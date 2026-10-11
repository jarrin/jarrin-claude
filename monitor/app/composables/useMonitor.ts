import { WATCH_PATH } from "#shared/protocol";
import type {
  ControlAction,
  HostCommand,
  WatchMessage,
  WatcherMessage,
} from "#shared/protocol";
import { applyWatchMessage, emptyState, noticesFor } from "~/utils/instances";
import type { MonitorState, Notice } from "~/utils/instances";

const RECONNECT_MS = 2000;

/**
 * The live monitor state, kept in sync over `/ws/watch`, plus the actions a
 * watcher can take. Every (re)connect starts with a full snapshot, so a dropped
 * socket loses nothing. `onNotice` gets what deserves a desktop notification.
 *
 * The socket needs a login. When it closes, an expired session is told apart
 * from a network blip by asking nuxt-auth-utils' session endpoint (which the
 * auth middleware guards too): a 401 there sends the page through the login.
 */
export function useMonitor(onNotice: (notice: Notice) => void) {
  const state = shallowRef<MonitorState>(emptyState);
  const connected = ref(false);
  let socket: WebSocket | null = null;
  let stopped = false;

  const connect = (): void => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}${WATCH_PATH}`);
    socket = ws;
    ws.onopen = () => (connected.value = true);
    ws.onmessage = (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as WatchMessage;
      for (const notice of noticesFor(state.value, msg)) onNotice(notice);
      state.value = applyWatchMessage(state.value, msg);
    };
    ws.onclose = () => {
      connected.value = false;
      socket = null;
      if (stopped) return;
      void fetch("/api/_auth/session").then(
        (res) => {
          if (res.status === 401) location.assign("/auth/login");
          else setTimeout(connect, RECONNECT_MS);
        },
        () => setTimeout(connect, RECONNECT_MS),
      );
    };
  };

  /** False when the socket is down, so the caller can keep what was typed. */
  const send = (msg: WatcherMessage): boolean => {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(msg));
    return true;
  };

  onMounted(connect);
  onBeforeUnmount(() => {
    stopped = true;
    socket?.close();
  });

  return {
    state,
    connected,
    dismiss: (id: string) => send({ type: "dismiss", id }),
    answer: (questionId: string, text: string) =>
      send({ type: "answer", questionId, text }),
    control: (id: string, action: ControlAction) =>
      send({ type: "control", id, action }),
    input: (id: string, text: string) => send({ type: "input", id, text }),
    dismissLive: (id: string) => send({ type: "dismiss-live", id }),
    /**
     * Send a command to a host; its `command-result` comes back under the
     * returned id. Null when the socket is down and nothing was sent.
     */
    command: (host: string, command: HostCommand): string | null => {
      const id = crypto.randomUUID();
      return send({ type: "command", id, host, command }) ? id : null;
    },
  };
}
