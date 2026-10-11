import { createHmac, timingSafeEqual } from "node:crypto";

import type { ForgeEvent } from "#shared/protocol";

/**
 * Gitea webhooks (`/api/webhook/gitea`). Gitea signs each delivery with the
 * hook's secret: `X-Gitea-Signature` is the hex HMAC-SHA256 of the raw body.
 * That signature is the delivery's only credential — it is a process, not a
 * browser, and it cannot present the agent token.
 */

/** Whether `signature` is the body's HMAC under `secret`. Empty `secret` admits nothing. */
export function giteaSignatureOk(
  secret: string,
  body: string,
  signature: string | undefined,
): boolean {
  if (!secret || !signature) return false;
  const want = createHmac("sha256", secret).update(body).digest();
  const got = Buffer.from(signature.trim(), "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

/** The relayable gist of a delivery; null when the body names no repository. */
export function parseGiteaWebhook(
  event: string | undefined,
  body: string,
): ForgeEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return null;
  }
  const repo = field(field(payload, "repository"), "full_name");
  if (typeof repo !== "string" || !repo.includes("/")) return null;
  const action = field(payload, "action");
  return {
    repo,
    event: event ?? "",
    action: typeof action === "string" ? action : "",
  };
}
