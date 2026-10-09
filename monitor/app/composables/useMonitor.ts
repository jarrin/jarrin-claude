import { WATCH_PATH } from "#shared/protocol";
import type {
  InstanceView,
  WatchMessage,
  WatcherMessage,
} from "#shared/protocol";
import { applyWatchMessage } from "~/utils/instances";

const RECONNECT_MS = 2000;

/**
 * The live list of loop instances, kept in sync over `/ws/watch`. Every
 * (re)connect starts with a full snapshot, so a dropped socket loses nothing.
 */
export function useMonitor() {
  const instances = ref<InstanceView[]>([]);
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
      instances.value = applyWatchMessage(instances.value, msg);
    };
    ws.onclose = () => {
      connected.value = false;
      socket = null;
      if (!stopped) setTimeout(connect, RECONNECT_MS);
    };
  };

  const send = (msg: WatcherMessage): void => {
    socket?.send(JSON.stringify(msg));
  };

  onMounted(connect);
  onBeforeUnmount(() => {
    stopped = true;
    socket?.close();
  });

  return {
    instances,
    connected,
    dismiss: (id: string) => send({ type: "dismiss", id }),
  };
}
