import { describe, expect, it } from "vitest";

import { browserGate, isPublicPath, oidcConfigured, tokenOk } from "./auth";

const base = {
  path: "/",
  configured: true,
  dev: false,
  loggedIn: false,
  wantsPage: true,
};

describe("tokenOk", () => {
  it("admits only the exact configured token", () => {
    expect(tokenOk("secret", "secret")).toBe(true);
    expect(tokenOk("secret", "secreT")).toBe(false);
    expect(tokenOk("secret", "secret2")).toBe(false);
    expect(tokenOk("secret", undefined)).toBe(false);
  });

  it("admits nobody when no token is configured", () => {
    expect(tokenOk("", "")).toBe(false);
    expect(tokenOk("", undefined)).toBe(false);
    expect(tokenOk("", "anything")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("leaves health, login and the token-authenticated channels public", () => {
    for (const p of [
      "/healthz",
      "/api/webhook/gitea",
      "/auth/login",
      "/auth/callback?code=x&state=y",
      "/auth/logout",
      "/ws/agent",
      "/ws/host",
      "/api/live",
    ])
      expect(isPublicPath(p), p).toBe(true);
  });

  it("guards the UI, the watch socket and everything else", () => {
    for (const p of [
      "/",
      "/ws/watch",
      "/api/_auth/session",
      "/healthz2",
      "/authx",
    ])
      expect(isPublicPath(p), p).toBe(false);
  });
});

describe("oidcConfigured", () => {
  it("needs every setting", () => {
    const full = {
      issuer: "https://auth.example",
      clientId: "c",
      clientSecret: "s",
      redirectUri: "https://x/auth/callback",
    };
    expect(oidcConfigured(full)).toBe(true);
    expect(oidcConfigured({ ...full, clientSecret: "" })).toBe(false);
  });
});

describe("browserGate", () => {
  it("sends a logged-out page load to the login", () => {
    expect(browserGate(base)).toBe("login");
  });

  it("rejects a watcher upgrade without a session", () => {
    expect(browserGate({ ...base, path: "/ws/watch", wantsPage: false })).toBe(
      "deny",
    );
  });

  it("passes a logged-in watcher and page", () => {
    expect(browserGate({ ...base, loggedIn: true })).toBe("pass");
    expect(
      browserGate({
        ...base,
        path: "/ws/watch",
        loggedIn: true,
        wantsPage: false,
      }),
    ).toBe("pass");
  });

  it("never asks for a login on public paths", () => {
    expect(browserGate({ ...base, path: "/healthz" })).toBe("pass");
    expect(browserGate({ ...base, path: "/ws/agent", configured: false })).toBe(
      "pass",
    );
  });

  it("closes the UI in production when login is not configured, opens it in dev", () => {
    expect(browserGate({ ...base, configured: false })).toBe("unconfigured");
    expect(
      browserGate({
        ...base,
        path: "/ws/watch",
        configured: false,
        wantsPage: false,
      }),
    ).toBe("unconfigured");
    expect(browserGate({ ...base, configured: false, dev: true })).toBe("pass");
  });
});
