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

export interface Comment {
  readonly id: number;
  readonly body: string;
  readonly url: string;
}

/** One of the loop's own tickets in a milestone (open questions, progress). */
export interface LoopTicket {
  readonly number: number;
  readonly url: string;
  readonly body: string;
}

/**
 * Every ticket the loop files carries a marker of this shape in its body. Tickets are
 * found by marker (never by title, which the user may edit) and are never worked.
 */
export const LOOP_MARKER_PREFIX = "<!-- claudjar-loop:";

/** What a loop ticket is called, found by, and created with. */
export interface LoopTicketSpec {
  readonly marker: string;
  readonly title: string;
  readonly body: string;
}

/** What the loop reads and writes; an interface so the driver tests use a fake. */
export interface GiteaClient {
  resolveMilestone(ref: string): Promise<Milestone>;
  /** Open issues of the milestone, minus the loop's own tickets. */
  openIssues(milestone: Milestone): Promise<Issue[]>;
  isClosed(issue: number): Promise<boolean>;
  /** Find the milestone's ticket carrying `spec.marker` (reopening it), or create it. */
  ensureLoopTicket(
    milestone: Milestone,
    spec: LoopTicketSpec,
  ): Promise<LoopTicket>;
  editBody(issue: number, body: string): Promise<void>;
  closeIssue(issue: number): Promise<void>;
  comment(issue: number, body: string): Promise<Comment>;
  comments(issue: number): Promise<Comment[]>;
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

  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Authorization: `token ${auth.token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      throw new Error(
        `Gitea ${method} ${path} failed: HTTP ${String(res.status)}`,
      );
    }
    return res.json();
  }
  const get = (path: string): Promise<unknown> => request("GET", path);

  async function milestoneIssues(
    milestone: Milestone,
    state: "open" | "all",
  ): Promise<unknown[]> {
    const rows: unknown[] = [];
    for (let page = 1; ; page++) {
      const batch = asArray(
        await get(
          `/issues?state=${state}&type=issues&milestones=${String(milestone.id)}` +
            `&limit=${String(PAGE)}&page=${String(page)}`,
        ),
      );
      rows.push(...batch);
      if (batch.length < PAGE) return rows;
    }
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
      return (await milestoneIssues(milestone, "open"))
        .filter((row) => !stringField(row, "body").includes(LOOP_MARKER_PREFIX))
        .map(toIssue)
        .filter((i): i is Issue => i !== null);
    },

    async isClosed(issue: number): Promise<boolean> {
      return field(await get(`/issues/${String(issue)}`), "state") === "closed";
    },

    async ensureLoopTicket(
      milestone: Milestone,
      spec: LoopTicketSpec,
    ): Promise<LoopTicket> {
      const found = (await milestoneIssues(milestone, "all")).find((row) =>
        stringField(row, "body").includes(spec.marker),
      );
      const row =
        found ??
        (await request("POST", "/issues", {
          title: spec.title,
          milestone: milestone.id,
          body: spec.body,
        }));
      const number = field(row, "number");
      if (typeof number !== "number")
        throw new Error(`"${spec.title}" ticket: unexpected response`);
      if (found !== undefined && field(found, "state") !== "open")
        await request("PATCH", `/issues/${String(number)}`, { state: "open" });
      return {
        number,
        url: stringField(row, "html_url"),
        body: stringField(row, "body"),
      };
    },

    async editBody(issue: number, body: string): Promise<void> {
      await request("PATCH", `/issues/${String(issue)}`, { body });
    },

    async closeIssue(issue: number): Promise<void> {
      await request("PATCH", `/issues/${String(issue)}`, { state: "closed" });
    },

    async comment(issue: number, body: string): Promise<Comment> {
      const c = toComment(
        await request("POST", `/issues/${String(issue)}/comments`, { body }),
      );
      if (!c) throw new Error(`commenting on #${String(issue)} failed`);
      return c;
    },

    async comments(issue: number): Promise<Comment[]> {
      return asArray(await get(`/issues/${String(issue)}/comments`))
        .map(toComment)
        .filter((c): c is Comment => c !== null);
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

function stringField(value: unknown, key: string): string {
  const v = field(value, key);
  return typeof v === "string" ? v : "";
}

function toComment(value: unknown): Comment | null {
  const id = field(value, "id");
  return typeof id === "number"
    ? {
        id,
        body: stringField(value, "body"),
        url: stringField(value, "html_url"),
      }
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
