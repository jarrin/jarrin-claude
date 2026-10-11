import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

import { parse } from "yaml";

/**
 * `/etc/claudjar.conf` — the machine-wide config of the claudjar service.
 *
 * ```yaml
 * projects_dir: /home/jarrin/Projects   # absolute; its direct children are the projects
 * user: jarrin                          # the account the systemd unit runs as
 * monitor:                              # optional: without it the service runs unlinked
 *   url: wss://claudjar.jarrin.nl
 *   token: <secret>                     # the monitor's NUXT_AGENT_TOKEN; required
 * ```
 *
 * Unlike `.jarrin.yml`, which degrades to "nothing selected" so a session never
 * fails to start, this parser fails loudly: a service that silently ran with no
 * projects dir, or as the wrong user, is worse than one that refuses to start.
 * Unknown keys are errors too — a typo (`project_dir`) would otherwise be dropped
 * without a trace.
 */

export const DEFAULT_CONF_PATH = "/etc/claudjar.conf";

export interface MonitorConf {
  readonly url: string;
  /** The monitor's `NUXT_AGENT_TOKEN`; it turns away any host without it. */
  readonly token: string;
}

export interface ServiceConf {
  readonly projectsDir: string;
  readonly user: string;
  /** Null when the service runs without the web interface. */
  readonly monitor: MonitorConf | null;
}

export class ConfError extends Error {
  constructor(
    readonly path: string,
    readonly problems: readonly string[],
  ) {
    super(
      `${path}: invalid claudjar service config:\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ConfError";
  }
}

/** The conf path: `$CLAUDJAR_CONF` when set (tests, a second instance), else `/etc/claudjar.conf`. */
export function confPath(env: NodeJS.ProcessEnv): string {
  const override = env.CLAUDJAR_CONF?.trim();
  return override ? override : DEFAULT_CONF_PATH;
}

/** POSIX portable user name, as `useradd` accepts it. */
const USER_RE = /^[a-z_][a-z0-9_-]*\$?$/;

const TOP_KEYS = new Set(["projects_dir", "user", "monitor"]);
const MONITOR_KEYS = new Set(["url", "token"]);

function isMap(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Parse the conf text. Throws {@link ConfError} listing every problem at once. */
export function parseConf(text: string, path = DEFAULT_CONF_PATH): ServiceConf {
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (err) {
    throw new ConfError(path, [
      `not valid YAML: ${err instanceof Error ? err.message : String(err)}`,
    ]);
  }
  if (!isMap(doc)) {
    throw new ConfError(path, [
      "expected a mapping with `projects_dir` and `user`",
    ]);
  }

  const problems: string[] = [];
  for (const key of Object.keys(doc)) {
    if (!TOP_KEYS.has(key)) problems.push(`unknown key \`${key}\``);
  }

  const projectsDir =
    typeof doc.projects_dir === "string" ? doc.projects_dir.trim() : "";
  if (!projectsDir) {
    problems.push("`projects_dir` is required (an absolute path)");
  } else if (!isAbsolute(projectsDir)) {
    problems.push(`\`projects_dir\` must be absolute, got \`${projectsDir}\``);
  }

  const user = typeof doc.user === "string" ? doc.user.trim() : "";
  if (!user) {
    problems.push("`user` is required (the account the service runs as)");
  } else if (!USER_RE.test(user)) {
    problems.push(`\`user\` is not a valid user name: \`${user}\``);
  } else if (user === "root") {
    problems.push("`user` must not be root — the service runs at user level");
  }

  let monitor: MonitorConf | null = null;
  if (doc.monitor !== undefined && doc.monitor !== null) {
    if (!isMap(doc.monitor)) {
      problems.push("`monitor` must be a mapping with `url` and `token`");
    } else {
      for (const key of Object.keys(doc.monitor)) {
        if (!MONITOR_KEYS.has(key))
          problems.push(`unknown key \`monitor.${key}\``);
      }
      const { url, token } = doc.monitor;
      let urlOk = false;
      if (typeof url !== "string" || !url.trim()) {
        problems.push("`monitor.url` is required when `monitor` is set");
      } else if (!/^(wss?|https?):\/\/[^/\s]+/.test(url.trim())) {
        problems.push(
          `\`monitor.url\` must be a ws(s):// or http(s):// URL, got \`${url}\``,
        );
      } else {
        urlOk = true;
      }
      // The monitor rejects every host without its token, so a missing one is
      // caught here rather than as a reconnect loop in the service log.
      let tokenOk = false;
      if (token !== undefined && token !== null && typeof token !== "string") {
        problems.push("`monitor.token` must be a string");
      } else if (typeof token !== "string" || !token.trim()) {
        problems.push(
          "`monitor.token` is required when `monitor` is set (the monitor's NUXT_AGENT_TOKEN)",
        );
      } else {
        tokenOk = true;
      }
      if (
        urlOk &&
        tokenOk &&
        typeof url === "string" &&
        typeof token === "string"
      ) {
        monitor = { url: url.trim(), token: token.trim() };
      }
    }
  }

  if (problems.length > 0) throw new ConfError(path, problems);
  return { projectsDir, user, monitor };
}

/** Read and parse the conf. A missing or unreadable file is a {@link ConfError}. */
export function readConf(path: string): ServiceConf {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    const code =
      err instanceof Error && "code" in err ? String(err.code) : "unknown";
    throw new ConfError(path, [
      code === "ENOENT"
        ? `file not found — create it, e.g.:\n\n${EXAMPLE_CONF}`
        : `cannot read it (${code})`,
    ]);
  }
  return parseConf(text, path);
}

export const EXAMPLE_CONF = [
  "projects_dir: /home/<user>/Projects",
  "user: <user>",
  "monitor:",
  "  url: wss://claudjar.jarrin.nl",
  "  token: <secret>",
].join("\n");
