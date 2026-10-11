/**
 * `claudjar loop` instances connect here. The first message must be `hello`,
 * carrying `NUXT_AGENT_TOKEN` (mandatory: with none configured, every loop is
 * turned away). The reply is a `welcome` with the stored state of the
 * instance's milestones.
 */
const instanceOf = new Map<string, string>(); // peer id → instance id
const peerOf = new Map<string, string>(); // instance id → its current peer id

export default defineWebSocketHandler({
  message(peer, message) {
    const msg = parseAgentMessage(message.text());
    if (!msg) return;
    const hub = useHub();
    const id = instanceOf.get(peer.id);
    if (msg.type === "hello") {
      const { agentToken } = useRuntimeConfig();
      if (!tokenOk(agentToken, msg.token)) {
        peer.close(4401, "bad token");
        return;
      }
      instanceOf.set(peer.id, msg.instance.id);
      peerOf.set(msg.instance.id, peer.id);
      hub.hello(msg.instance, (out) => peer.send(JSON.stringify(out)));
      return;
    }
    if (!id) return;
    switch (msg.type) {
      case "log":
        hub.log(id, msg.lines);
        break;
      case "status":
        hub.status(id, msg.status, msg.paused);
        break;
      case "progress":
        hub.progress(id, msg.milestone, msg.entries);
        break;
      case "ask":
        hub.ask(id, msg.question);
        break;
      case "resolved":
        hub.resolved(msg.questionId);
        break;
    }
  },
  close(peer) {
    const id = instanceOf.get(peer.id);
    instanceOf.delete(peer.id);
    // A reconnect may already have replaced this peer; only the current one counts.
    if (id && peerOf.get(id) === peer.id) {
      peerOf.delete(id);
      useHub().disconnect(id);
    }
  },
});
