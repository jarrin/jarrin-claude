import { WATCH_PATH } from "#shared/protocol";

/**
 * Browsers connect here for the snapshot, the live stream, and to answer / steer
 * loops and command hosts. The upgrade needs a logged-in session: the HTTP
 * middleware never sees a WebSocket upgrade, so the check lives here.
 */
const unwatch = new Map<string, () => void>();

export default defineWebSocketHandler({
  async upgrade(request) {
    // On a bare upgrade request h3 cannot start a fresh session (there is no
    // response to set its cookie on), so a missing, expired or forged cookie
    // makes it throw instead of returning an empty one: "not logged in".
    let loggedIn: boolean;
    try {
      loggedIn = Boolean((await getUserSession(request)).user);
    } catch {
      loggedIn = false;
    }
    const { oidc } = useRuntimeConfig();
    const verdict = browserGate({
      path: WATCH_PATH,
      configured: oidcConfigured(oidc),
      dev: import.meta.dev,
      loggedIn,
      wantsPage: false,
    });
    if (verdict !== "pass")
      throw new Response("login required", { status: 401 });
  },
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
      case "dismiss-live":
        hub.dismissLive(msg.id);
        break;
      case "command":
        hub.command(msg.id, msg.host, msg.command);
        break;
    }
  },
  close(peer) {
    unwatch.get(peer.id)?.();
    unwatch.delete(peer.id);
  },
});
