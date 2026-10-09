/** Browsers connect here for the snapshot, the live stream, and to answer / steer loops. */
const unwatch = new Map<string, () => void>();

export default defineWebSocketHandler({
  open(peer) {
    unwatch.set(
      peer.id,
      useHub().watch((msg) => peer.send(JSON.stringify(msg))),
    );
  },
  message(_peer, message) {
    const msg = parseWatcherMessage(message.text());
    if (!msg) return;
    const hub = useHub();
    switch (msg.type) {
      case "dismiss":
        hub.dismiss(msg.id);
        break;
      case "answer":
        hub.answer(msg.questionId, msg.text);
        break;
      case "control":
        hub.control(msg.id, msg.action);
        break;
      case "input":
        hub.input(msg.id, msg.text);
        break;
    }
  },
  close(peer) {
    unwatch.get(peer.id)?.();
    unwatch.delete(peer.id);
  },
});
