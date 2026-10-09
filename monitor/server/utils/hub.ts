import type {
  InstanceInfo,
  InstanceSummary,
  InstanceView,
  LogLine,
  WatchMessage,
} from "#shared/protocol";

/** Lines kept per instance; older ones scroll off. */
export const MAX_LINES = 5000;
/** An offline instance is forgotten after this long. */
export const OFFLINE_TTL_MS = 24 * 60 * 60 * 1000;

interface Instance {
  info: InstanceInfo;
  online: boolean;
  status: string;
  lastSeen: number;
  lines: LogLine[];
}

export type Send = (msg: WatchMessage) => void;

/**
 * In-memory state of every loop instance and fan-out to the watching browsers.
 * Nothing is persisted: a restart starts empty, and agents re-announce
 * themselves on reconnect.
 */
export class Hub {
  private readonly instances = new Map<string, Instance>();
  private readonly watchers = new Set<Send>();

  constructor(private readonly now: () => number = Date.now) {}

  watch(send: Send): () => void {
    this.prune();
    this.watchers.add(send);
    send({
      type: "snapshot",
      instances: [...this.instances.values()].map(view),
    });
    return () => this.watchers.delete(send);
  }

  /** An agent (re)connected; returns its id for the later calls. */
  hello(info: InstanceInfo): string {
    const existing = this.instances.get(info.id);
    const inst: Instance = existing ?? {
      info,
      online: true,
      status: "running",
      lastSeen: this.now(),
      lines: [],
    };
    inst.info = info;
    inst.online = true;
    inst.lastSeen = this.now();
    this.instances.set(info.id, inst);
    this.broadcastSummary(inst);
    return info.id;
  }

  log(id: string, lines: readonly LogLine[]): void {
    const inst = this.instances.get(id);
    if (!inst || lines.length === 0) return;
    inst.lines.push(...lines);
    if (inst.lines.length > MAX_LINES)
      inst.lines.splice(0, inst.lines.length - MAX_LINES);
    inst.lastSeen = this.now();
    this.broadcast({ type: "log", id, lines });
  }

  status(id: string, status: string): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    inst.status = status;
    inst.lastSeen = this.now();
    this.broadcastSummary(inst);
  }

  disconnect(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    inst.online = false;
    inst.lastSeen = this.now();
    this.broadcastSummary(inst);
  }

  /** A watcher closed a tab. Only offline instances can be dismissed. */
  dismiss(id: string): void {
    const inst = this.instances.get(id);
    if (!inst || inst.online) return;
    this.instances.delete(id);
    this.broadcast({ type: "removed", id });
  }

  private prune(): void {
    const cutoff = this.now() - OFFLINE_TTL_MS;
    for (const [id, inst] of this.instances)
      if (!inst.online && inst.lastSeen < cutoff) this.instances.delete(id);
  }

  private broadcastSummary(inst: Instance): void {
    this.broadcast({ type: "instance", instance: summary(inst) });
  }

  private broadcast(msg: WatchMessage): void {
    for (const send of this.watchers) send(msg);
  }
}

function summary(inst: Instance): InstanceSummary {
  return {
    ...inst.info,
    online: inst.online,
    status: inst.status,
    lastSeen: inst.lastSeen,
  };
}

function view(inst: Instance): InstanceView {
  return { ...summary(inst), lines: [...inst.lines] };
}

/** The one hub of this server process. */
export const hub = new Hub();
