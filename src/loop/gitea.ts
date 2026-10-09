import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getCACertificates, setDefaultCACertificates } from "node:tls";

/** Where the Gitea REST API lives and the token that reads it. */
export interface GiteaAuth {
  readonly host: string;
  readonly token: string;
}

export interface Milestone {
  readonly id: number;
  readonly title: string;
}

export interface Issue {
  readonly number: number;
  readonly title: string;
}

/** The three reads the loop needs; an interface so the driver tests use a fake. */
export interface GiteaClient {
  resolveMilestone(ref: string): Promise<Milestone>;
  openIssues(milestone: Milestone): Promise<Issue[]>;
  isClosed(issue: number): Promise<boolean>;
}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

const PAGE = 50;

/**
 * Resolve Gitea credentials: `GITEA_HOST` / `GITEA_ACCESS_TOKEN` in the environment
 * win, otherwise the `gitea` MCP server's env in `~/.claude.json` — the same token
 * the sessions the loop spawns will use, so the two can never disagree.
 */
export function resolveAuth(
  env: NodeJS.ProcessEnv,
  claudeJson: string | null = readClaudeJson(),
): GiteaAuth | null {
  const fromEnv = authFrom(env.GITEA_HOST, env.GITEA_ACCESS_TOKEN);
  if (fromEnv) return fromEnv;
  if (claudeJson === null) return null;
  let doc: unknown;
  try {
    doc = JSON.parse(claudeJson);
  } catch {
    return null;
  }
  const mcpEnv = field(field(field(doc, "mcpServers"), "gitea"), "env");
  return authFrom(
    field(mcpEnv, "GITEA_HOST"),
    field(mcpEnv, "GITEA_ACCESS_TOKEN"),
  );
}

function readClaudeJson(): string | null {
  try {
    return readFileSync(join(homedir(), ".claude.json"), "utf8");
  } catch {
    return null;
  }
}

function field(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object") return undefined;
  return (value as Record<string, unknown>)[key];
}

function authFrom(host: unknown, token: unknown): GiteaAuth | null {
  if (typeof host !== "string" || typeof token !== "string") return null;
  if (host === "" || token === "") return null;
  return { host: host.replace(/\/+$/, ""), token };
}

let systemCAsTrusted = false;

/**
 * Node trusts only its bundled CAs, so a self-hosted Gitea behind a private CA
 * (git.jarrin.nl: `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, while curl is fine) fails
 * every fetch. Add the OS store, as curl and the browser already do.
 */
function trustSystemCAs(): void {
  if (systemCAsTrusted) return;
  setDefaultCACertificates([
    ...getCACertificates("default"),
    ...getCACertificates("system"),
  ]);
  systemCAsTrusted = true;
}

export function giteaClient(
  auth: GiteaAuth,
  repo: string,
  fetchImpl: FetchFn = fetch,
): GiteaClient {
  trustSystemCAs();
  const base = `${auth.host}/api/v1/repos/${repo}`;

  async function get(path: string): Promise<unknown> {
    const res = await fetchImpl(`${base}${path}`, {
      headers: {
        Authorization: `token ${auth.token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Gitea GET ${path} failed: HTTP ${String(res.status)}`);
    }
    return res.json();
  }

  return {
    async resolveMilestone(ref: string): Promise<Milestone> {
      if (/^\d+$/.test(ref)) {
        const m = toMilestone(await get(`/milestones/${ref}`));
        if (!m) throw new Error(`milestone #${ref}: unexpected response`);
        return m;
      }
      // `name=` is a substring match (backlog reference §2): narrow, then match exactly.
      const list = await get(
        `/milestones?state=open&limit=${String(PAGE)}&name=${encodeURIComponent(ref)}`,
      );
      const exact = asArray(list)
        .map(toMilestone)
        .filter((m): m is Milestone => m !== null && m.title === ref);
      if (exact.length === 0)
        throw new Error(`no open milestone titled "${ref}"`);
      if (exact.length > 1) {
        const ids = exact.map((m) => `#${String(m.id)}`).join(", ");
        throw new Error(
          `"${ref}" matches ${String(exact.length)} open milestones (${ids}); pass the id instead`,
        );
      }
      return exact[0] as Milestone;
    },

    async openIssues(milestone: Milestone): Promise<Issue[]> {
      const issues: Issue[] = [];
      for (let page = 1; ; page++) {
        const rows = asArray(
          await get(
            `/issues?state=open&type=issues&milestones=${String(milestone.id)}` +
              `&limit=${String(PAGE)}&page=${String(page)}`,
          ),
        );
        for (const row of rows) {
          const issue = toIssue(row);
          if (issue) issues.push(issue);
        }
        if (rows.length < PAGE) return issues;
      }
    },

    async isClosed(issue: number): Promise<boolean> {
      return field(await get(`/issues/${String(issue)}`), "state") === "closed";
    },
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

function toMilestone(value: unknown): Milestone | null {
  const id = field(value, "id");
  const title = field(value, "title");
  return typeof id === "number" && typeof title === "string"
    ? { id, title }
    : null;
}

function toIssue(value: unknown): Issue | null {
  const num = field(value, "number");
  const title = field(value, "title");
  return typeof num === "number" && typeof title === "string"
    ? { number: num, title }
    : null;
}

const STAGE = /^Stage (\d+)\b/;

/**
 * Work order inside one milestone: `Stage <n>` tickets by n (newest-first server
 * order would run the LAST stage first — backlog reference §6), then every other
 * ticket by issue number, oldest first.
 */
export function workOrder(issues: readonly Issue[]): Issue[] {
  const stageOf = (i: Issue): number | null => {
    const m = STAGE.exec(i.title);
    return m ? Number(m[1]) : null;
  };
  return [...issues].sort((a, b) => {
    const sa = stageOf(a);
    const sb = stageOf(b);
    if (sa !== null && sb !== null) return sa - sb || a.number - b.number;
    if (sa !== null) return -1;
    if (sb !== null) return 1;
    return a.number - b.number;
  });
}
