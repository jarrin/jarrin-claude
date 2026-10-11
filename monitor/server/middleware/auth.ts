/**
 * Every browser request needs a login; see `utils/auth.ts` for the paths that
 * authenticate by token instead. `/ws/watch` is also checked in its own upgrade
 * hook, since a WebSocket upgrade does not pass through this middleware.
 */
export default defineEventHandler(async (event) => {
  const { oidc } = useRuntimeConfig(event);
  const verdict = browserGate({
    path: event.path,
    configured: oidcConfigured(oidc),
    dev: import.meta.dev,
    loggedIn: Boolean((await getUserSession(event)).user),
    wantsPage:
      event.method === "GET" &&
      (getRequestHeader(event, "accept") ?? "").includes("text/html"),
  });
  switch (verdict) {
    case "pass":
      return;
    case "login":
      return sendRedirect(event, "/auth/login");
    case "deny":
      throw createError({ statusCode: 401, statusMessage: "login required" });
    case "unconfigured":
      throw createError({
        statusCode: 503,
        statusMessage: "login is not configured (NUXT_OIDC_*)",
      });
  }
});
