import { hostname } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

import { buildCommand } from "@stricli/core";

import { LIVE_PATH } from "../../monitor/shared/protocol.js";
import type { LivePost } from "../../monitor/shared/protocol.js";
import type { LocalContext } from "../context.js";
import { follow } from "../live/follow.js";
import { LOOP_ENV } from "../loop/runner.js";
import { redirectTarget } from "../loop/tail.js";

/** The subset of the PreToolUse payload this hook reads. */
interface PreToolUsePayload {
  readonly session_id?: string;
  readonly cwd?: string;
  readonly tool_name?: string;
  readonly tool_use_id?: string;
  readonly tool_input?: { readonly command?: unknown };
}

export interface LiveTarget {
  /** The monitor's `/api/live` endpoint, over http(s). */
  readonly url: string;
  readonly post: Omit<LivePost, "chunk" | "done" | "startedAt">;
}

/**
 * What to follow for one PreToolUse call, or `null` when there is nothing to do:
 * not a Bash call, no output file, no monitor configured, or a loop session.
 */
export function liveTarget(
  payload: PreToolUsePayload,
  env: NodeJS.ProcessEnv,
  host: string,
): LiveTarget | null {
  const monitor = env.CLAUDJAR_MONITOR_URL;
  if (!monitor || env[LOOP_ENV] || payload.tool_name !== "Bash") return null;
  const command = payload.tool_input?.command;
  const cwd = payload.cwd;
  const id = payload.tool_use_id;
  if (typeof command !== "string" || !cwd || !id) return null;
  const file = redirectTarget(command, cwd);
  if (!file) return null;
  const token = env.CLAUDJAR_MONITOR_TOKEN;
  return {
    url: new URL(LIVE_PATH, monitor.replace(/^ws(s?):/, "http$1:")).href,
    post: {
      ...(token ? { token } : {}),
      id,
      file,
      command,
      source: {
        kind: "session",
        host,
        where: cwd,
        session: payload.session_id ?? "",
      },
    },
  };
}

/**
 * PreToolUse hook (async, matcher `Bash`). When the call writes its output to a
 * file, stay alive and stream that file to the claudjar monitor's live logs
 * until the call ends. Prints nothing and always exits 0: the session must never
 * notice it, monitor or no monitor.
 */
async function runLiveLog(this: LocalContext): Promise<void> {
  const proc = this.process;
  const target = liveTarget(await readPayload(proc), proc.env, hostname());
  if (!target) return;
  const startedAt = Date.now();
  await follow({
    file: target.post.file,
    now: Date.now,
    sleep: (ms) => sleep(ms),
    send: async (chunk, done) => {
      const body: LivePost = { ...target.post, startedAt, chunk, done };
      try {
        const res = await fetch(target.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  });
}

async function readPayload(proc: NodeJS.Process): Promise<PreToolUsePayload> {
  if (proc.stdin.isTTY) return {};
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of proc.stdin)
      chunks.push(Buffer.from(chunk as Buffer));
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Unreadable/invalid stdin — nothing to follow.
  }
  return {};
}

export const liveLogCommand = buildCommand({
  func: runLiveLog,
  parameters: { flags: {} },
  docs: {
    brief:
      "[internal] PreToolUse hook: stream a Bash call's output file to the monitor's live logs",
    fullDescription:
      "INTERNAL — invoked by Claude Code as an async PreToolUse hook on Bash " +
      "(`claudjar api live-log`, registered in claude/settings.json); not for " +
      "manual use.\n\n" +
      "When the call redirects its output to a file (`cmd > out.log`, " +
      "`| tee out.log`) and CLAUDJAR_MONITOR_URL is set, it follows that file and " +
      "POSTs what is appended to the monitor until no process holds the file open " +
      "for writing any more. Sessions spawned by `claudjar loop` are skipped " +
      `(${LOOP_ENV} is set) — the loop streams their files itself.`,
  },
});
