/**
 * `claudjar loop` instances connect here. The first message must be `hello`;
 * when `NUXT_AGENT_TOKEN` is set it must carry that token.
 */
const instanceOf = new Map<string, string>(); // peer id → instance id
const peerOf = new Map<string, string>(); // instance id → its current peer id

export default defineWebSocketHandler({
  message(peer, message) {
    const msg = parseAgentMessage(message.text());
    if (!msg) return;
    const id = instanceOf.get(peer.id);
    if (msg.type === "hello") {
      const { agentToken } = useRuntimeConfig();
      if (agentToken && msg.token !== agentToken) {
        peer.close(4401, "bad token");
        return;
      }
      instanceOf.set(peer.id, msg.instance.id);
      peerOf.set(msg.instance.id, peer.id);
      hub.hello(msg.instance);
      return;
    }
    if (!id) return;
    if (msg.type === "log") hub.log(id, msg.lines);
    else hub.status(id, msg.status);
  },
  close(peer) {
    const id = instanceOf.get(peer.id);
    instanceOf.delete(peer.id);
    // A reconnect may already have replaced this peer; only the current one counts.
    if (id && peerOf.get(id) === peer.id) {
      peerOf.delete(id);
      hub.disconnect(id);
    }
  },
});
