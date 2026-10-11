import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { giteaSignatureOk, parseGiteaWebhook } from "./webhook";

const sign = (secret: string, body: string): string =>
  createHmac("sha256", secret).update(body).digest("hex");

describe("giteaSignatureOk", () => {
  const body = '{"action":"opened"}';

  it("accepts the body's HMAC under the secret", () => {
    expect(giteaSignatureOk("s3cret", body, sign("s3cret", body))).toBe(true);
  });

  it("rejects another secret, a changed body, garbage and a missing header", () => {
    expect(giteaSignatureOk("s3cret", body, sign("other", body))).toBe(false);
    expect(giteaSignatureOk("s3cret", `${body} `, sign("s3cret", body))).toBe(
      false,
    );
    expect(giteaSignatureOk("s3cret", body, "zz")).toBe(false);
    expect(giteaSignatureOk("s3cret", body, undefined)).toBe(false);
  });

  it("admits nothing without a configured secret", () => {
    expect(giteaSignatureOk("", body, sign("", body))).toBe(false);
  });
});

describe("parseGiteaWebhook", () => {
  it("takes the repo, the event header and the action", () => {
    const body = JSON.stringify({
      action: "milestoned",
      repository: { full_name: "jarrin/app" },
    });
    expect(parseGiteaWebhook("issues", body)).toEqual({
      repo: "jarrin/app",
      event: "issues",
      action: "milestoned",
    });
  });

  it("keeps an event without an action, and drops one without a repository", () => {
    expect(
      parseGiteaWebhook(
        "push",
        JSON.stringify({ repository: { full_name: "o/r" } }),
      ),
    ).toEqual({ repo: "o/r", event: "push", action: "" });
    expect(parseGiteaWebhook("issues", "{}")).toBeNull();
    expect(parseGiteaWebhook("issues", "not json")).toBeNull();
  });
});
