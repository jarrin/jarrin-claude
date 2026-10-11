/**
 * `claudjar service` instances connect here. The first message must be
 * `host-hello` with `NUXT_AGENT_TOKEN` and the host's projects; afterwards the
 * host publishes project changes and answers the commands watchers send it.
 */
const hostOf = new Map<string, string>(); // peer id → host name
const peerOf = new Map<string, string>(); // host name → its current peer id

export default defineWebSocketHandler({
  message(peer, message) {
    const msg = parseHostMessage(message.text());
    if (!msg) return;
    const hub = useHub();
    if (msg.type === "host-hello") {
      if (!tokenOk(useRuntimeConfig().agentToken, msg.token)) {
        peer.close(4401, "bad token");
        return;
      }
      hostOf.set(peer.id, msg.host.host);
      peerOf.set(msg.host.host, peer.id);
      hub.hostHello(msg.host, msg.projects, (out) =>
        peer.send(JSON.stringify(out)),
      );
      return;
    }
    const host = hostOf.get(peer.id);
    if (!host) return;
    switch (msg.type) {
      case "projects":
        hub.hostProjects(host, msg.projects);
        break;
      case "project-state":
        hub.hostProject(host, msg.project);
        break;
      case "project-detail":
        hub.hostDetail(host, msg.detail);
        break;
      case "command-result":
        hub.hostResult(host, msg.result);
        break;
    }
  },
  close(peer) {
    const host = hostOf.get(peer.id);
    hostOf.delete(peer.id);
    // A reconnect may already have replaced this peer; only the current one counts.
    if (host && peerOf.get(host) === peer.id) {
      peerOf.delete(host);
      useHub().hostDisconnect(host);
    }
  },
});
