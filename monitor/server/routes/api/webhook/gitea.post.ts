/**
 * Gitea webhook deliveries. A signed delivery for a repo some host's project
 * uses as its backlog is relayed to that host as a `forge-event`; the host then
 * re-reads the forge itself (the todo watcher, `src/service/todo.ts`).
 */
export default defineEventHandler(async (event) => {
  const { webhookSecret } = useRuntimeConfig(event);
  if (!webhookSecret)
    throw createError({
      statusCode: 503,
      statusMessage: "webhooks are not configured (NUXT_WEBHOOK_SECRET)",
    });
  const body = (await readRawBody(event)) ?? "";
  if (
    !giteaSignatureOk(
      webhookSecret,
      body,
      getRequestHeader(event, "x-gitea-signature"),
    )
  )
    throw createError({ statusCode: 401, statusMessage: "bad signature" });
  const forge = parseGiteaWebhook(
    getRequestHeader(event, "x-gitea-event"),
    body,
  );
  if (!forge)
    throw createError({ statusCode: 400, statusMessage: "no repository" });
  return { relayed: useHub().forgeEvent(forge) };
});
