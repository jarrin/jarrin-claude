/** Browsers connect here for the snapshot and the live stream. */
const unwatch = new Map<string, () => void>();

export default defineWebSocketHandler({
  open(peer) {
    unwatch.set(
      peer.id,
      hub.watch((msg) => peer.send(JSON.stringify(msg))),
    );
  },
  message(_peer, message) {
    const msg = parseWatcherMessage(message.text());
    if (msg?.type === "dismiss") hub.dismiss(msg.id);
  },
  close(peer) {
    unwatch.get(peer.id)?.();
    unwatch.delete(peer.id);
  },
});
