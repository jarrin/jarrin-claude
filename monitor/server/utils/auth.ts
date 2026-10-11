import { timingSafeEqual } from "node:crypto";

/**
 * Who may talk to this server, and how.
 *
 * - **Browsers** (the UI and `/ws/watch`) need an OIDC login against the
 *   homeserver auth app; the session lives in nuxt-auth-utils' sealed cookie.
 * - **Processes** (loops on `/ws/agent`, services on `/ws/host`, live-log hook
 *   followers on `/api/live`) cannot do a browser login, so they present the
 *   shared `NUXT_AGENT_TOKEN` instead. The token is mandatory: with none
 *   configured, every process is turned away rather than every process let in.
 * - **Gitea webhooks** (`/api/webhook/gitea`) are signed with
 *   `NUXT_WEBHOOK_SECRET` instead (`utils/webhook.ts`).
 */

/** Paths that authenticate themselves (by token) or must stay reachable without a login. */
const PUBLIC_PATHS = new Set([
  "/healthz",
  "/ws/agent",
  "/ws/host",
  "/api/live",
  "/api/webhook/gitea",
]);

export function isPublicPath(path: string): boolean {
  const bare = path.split("?")[0] ?? "";
  return PUBLIC_PATHS.has(bare) || bare.startsWith("/auth/");
}

/** Whether a process presented the configured token. Empty `expected` admits nobody. */
export function tokenOk(expected: string, given: string | undefined): boolean {
  if (!expected || given === undefined) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface OidcConf {
  readonly issuer: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

/** Login works only with every OIDC setting present. */
export function oidcConfigured(c: OidcConf): boolean {
  return Boolean(c.issuer && c.clientId && c.clientSecret && c.redirectUri);
}

export type Gate = "pass" | "login" | "deny" | "unconfigured";

/**
 * What to do with a browser request. Without OIDC settings the UI is closed in
 * production (`unconfigured`) and open in `nuxt dev`, where there is no IdP to
 * redirect to. A page load without a session goes to the login; anything else
 * (an API call, a socket) is plainly denied.
 */
export function browserGate(opts: {
  readonly path: string;
  readonly configured: boolean;
  readonly dev: boolean;
  readonly loggedIn: boolean;
  readonly wantsPage: boolean;
}): Gate {
  if (isPublicPath(opts.path)) return "pass";
  if (!opts.configured) return opts.dev ? "pass" : "unconfigured";
  if (opts.loggedIn) return "pass";
  return opts.wantsPage ? "login" : "deny";
}
