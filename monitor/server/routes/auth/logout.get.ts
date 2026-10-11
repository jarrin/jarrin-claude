/**
 * Ends the session and says so, rather than redirecting to `/`: that would bounce
 * straight back through the login, and the IdP would sign the user in again.
 */
export default defineEventHandler(async (event) => {
  await clearUserSession(event);
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  return '<!doctype html><title>claudjar</title><p>Logged out. <a href="/auth/login">Log in again</a></p>';
});
