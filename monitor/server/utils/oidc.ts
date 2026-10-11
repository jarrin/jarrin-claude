import type { H3Event } from "h3";

/**
 * The OIDC code flow against the homeserver auth app, via nuxt-auth-utils'
 * generic provider: state, PKCE (S256) and nonce in short-lived cookies, the
 * code exchanged for tokens server-side with the client secret, and the user
 * read from the userinfo endpoint over that TLS back-channel.
 *
 * The provider takes its settings at definition time, but ours are runtime
 * config (`NUXT_OIDC_*`, set by the stack), so the handler is built per request.
 * `/auth/login` and `/auth/callback` both run it: without `?code` it redirects
 * to the IdP, with one it completes the login.
 */
export async function oidcFlow(event: H3Event): Promise<unknown> {
  const { oidc } = useRuntimeConfig(event);
  if (!oidcConfigured(oidc))
    throw createError({
      statusCode: 503,
      statusMessage: "login is not configured (NUXT_OIDC_*)",
    });
  // A callback without the state the login set is not one of ours; the
  // provider would compare two `undefined`s and wave it through.
  const query = getQuery(event);
  if (query.code !== undefined && !getCookie(event, "nuxt-auth-state"))
    throw createError({ statusCode: 400, statusMessage: "login expired" });
  // Userinfo is untrusted JSON until checked, so every claim starts as unknown.
  const handler = defineOAuthOidcEventHandler<
    Partial<Record<"sub" | "name" | "email", unknown>>
  >({
    config: {
      clientId: oidc.clientId,
      clientSecret: oidc.clientSecret,
      openidConfig: `${oidc.issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`,
      redirectURL: oidc.redirectUri,
      // The provider appends its default `openid` (defu concatenates arrays).
      scope: ["profile", "email"],
    },
    async onSuccess(event, { user: claims }) {
      if (typeof claims.sub !== "string" || !claims.sub)
        throw createError({ statusCode: 401, statusMessage: "no subject" });
      await setUserSession(event, {
        user: {
          sub: claims.sub,
          name: typeof claims.name === "string" ? claims.name : claims.sub,
          email: typeof claims.email === "string" ? claims.email : "",
        },
        loggedInAt: Date.now(),
      });
      return sendRedirect(event, "/");
    },
    onError(_event, error) {
      console.error(`claudjar monitor: login failed: ${error.message}`);
      throw createError({ statusCode: 401, statusMessage: "login failed" });
    },
  });
  return handler(event);
}
