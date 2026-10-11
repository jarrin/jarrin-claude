import { HOST_PATH } from "../../monitor/shared/protocol.js";
import type {
  ForgeEvent,
  HostCommand,
  HostInfo,
  HostMessage,
  ProjectDetail,
  ProjectInfo,
  ServerHostMessage,
} from "../../monitor/shared/protocol.js";
import { endpointUrl } from "../loop/monitor.js";
import type { SocketLike } from "../loop/monitor.js";
import { trustSystemCAs } from "../loop/trust.js";

/**
 * The service's link to the web interface (`monitor/`): it dials out to
 * `/ws/host` the way loops dial `/ws/agent`, so no inbound port is opened here.
 * It publishes the discovered projects and runs the commands watchers send.
 *
 * Like the loop client, it never fails the service. While the socket is down
 * nothing is lost: what the monitor needs is the *current* project list, and
 * every (re)connect's `host-hello` carries exactly that. A command whose socket
 * dropped is failed by the monitor itself ("host disconnected"), so its result
 * is not re-sent; its effect still arrives, in the next hello's project list.
 */

export interface HostLink {
  /** The project list after a scan; sent only when it differs from the last one. */
  publish(projects: readonly ProjectInfo[]): void;
  /** One project changed (opened, closed). */
  projectState(project: ProjectInfo): void;
  /** A project's freshly collected detail; dropped while the socket is down. */
  detail(detail: ProjectDetail): void;
  /** Disconnect for good. */
  close(): void;
}

export type CommandOutcome =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

export interface HostLinkOptions {
  readonly url: string;
  readonly token: string;
  readonly host: HostInfo;
  /** The current project list, for the hello on every (re)connect. */
  readonly projects: () => readonly ProjectInfo[];
  readonly onCommand: (command: HostCommand) => Promise<CommandOutcome>;
  /** A forge webhook the monitor relayed; optional for hosts that ignore them. */
  readonly onForgeEvent?: (event: ForgeEvent) => void;
  readonly log: (line: string) => void;
  readonly open?: (url: string) => SocketLike;
  readonly reconnectMs?: number;
}

const OPEN = 1;
const RECONNECT_MS = 3000;
/** The monitor's close code for a host or agent without the right token. */
const BAD_TOKEN = 4401;

export function hostUrl(base: string): string {
  return endpointUrl(base, HOST_PATH);
}

export function connectHost(opts: HostLinkOptions): HostLink {
  const open =
    opts.open ??
    ((url: string): SocketLike => {
      trustSystemCAs();
      return new WebSocket(url);
    });
  const url = hostUrl(opts.url);
  const reconnectMs = opts.reconnectMs ?? RECONNECT_MS;
  let socket: SocketLike | null = null;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** What the monitor last got, so an unchanged rescan sends nothing. */
  let lastSent = "";
  /** The last connection state logged, so a long outage logs once, not per retry. */
  let lastLogged = "";

  const note = (line: string): void => {
    if (line === lastLogged) return;
    lastLogged = line;
    opts.log(line);
  };

  const send = (msg: HostMessage): boolean => {
    if (socket?.readyState !== OPEN) return false;
    socket.send(JSON.stringify(msg));
    return true;
  };

  const run = async (id: string, command: HostCommand): Promise<void> => {
    let outcome: CommandOutcome;
    try {
      outcome = await opts.onCommand(command);
    } catch (err) {
      outcome = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    send({
      type: "command-result",
      result: { id, ok: outcome.ok, error: outcome.ok ? "" : outcome.error },
    });
  };

  const receive = (msg: ServerHostMessage): void => {
    switch (msg.type) {
      case "host-welcome":
        note(`monitor: connected to ${url}`);
        return;
      case "command":
        void run(msg.id, msg.command);
        return;
      case "forge-event":
        opts.onForgeEvent?.(msg.event);
        return;
    }
  };

  const retry = (): void => {
    if (!closed && retryTimer === null)
      retryTimer = setTimeout(connect, reconnectMs);
  };

  function connect(): void {
    retryTimer = null;
    let ws: SocketLike;
    try {
      ws = open(url);
    } catch (err) {
      note(
        `monitor: cannot connect to ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      retry();
      return;
    }
    socket = ws;
    ws.onopen = () => {
      const projects = opts.projects();
      lastSent = JSON.stringify(projects);
      send({
        type: "host-hello",
        host: opts.host,
        token: opts.token,
        projects: [...projects],
      });
    };
    ws.onmessage = (ev) => {
      let msg: ServerHostMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerHostMessage;
      } catch {
        return;
      }
      receive(msg);
    };
    ws.onerror = () => {};
    ws.onclose = (ev) => {
      if (socket === ws) socket = null;
      note(
        ev.code === BAD_TOKEN
          ? "monitor: rejected the token — check monitor.token against its NUXT_AGENT_TOKEN"
          : `monitor: disconnected from ${url}, retrying`,
      );
      retry();
    };
  }

  connect();

  return {
    publish: (projects) => {
      const json = JSON.stringify(projects);
      if (json === lastSent) return;
      if (send({ type: "projects", projects: [...projects] })) lastSent = json;
    },
    projectState: (project) => {
      send({ type: "project-state", project });
    },
    detail: (detail) => {
      send({ type: "project-detail", detail });
    },
    close: () => {
      closed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      const ws = socket;
      socket = null;
      if (!ws) return;
      ws.onclose = null;
      ws.close();
    },
  };
}
