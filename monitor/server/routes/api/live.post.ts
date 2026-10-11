/**
 * `claudjar api live-log` followers POST here: the next chunk of a file a Claude
 * Code session's Bash call writes its output to. Plain HTTP rather than a socket,
 * since a follower is a short-lived hook process that only ever sends.
 */
export default defineEventHandler(async (event) => {
  const post = parseLivePost((await readRawBody(event)) ?? "");
  if (!post) throw createError({ statusCode: 400, statusMessage: "bad post" });
  const { agentToken } = useRuntimeConfig();
  if (!tokenOk(agentToken, post.token))
    throw createError({ statusCode: 401, statusMessage: "bad token" });
  useHub().livePost(post);
  return "ok";
});
