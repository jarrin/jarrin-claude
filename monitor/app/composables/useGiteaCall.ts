import { issueUrl, milestoneUrl } from "~/utils/forge";
import { repoOf } from "~/utils/gitea";
import type { LogItem } from "~/utils/log";
import { num, str, toolCall } from "~/utils/tools";

/**
 * What every gitea tool component needs from its call: the decoded input, its
 * `method`, the repo it targets, and links into that repo on the forge.
 */
export function useGiteaCall(item: () => LogItem) {
  const forge = useForge();
  const call = computed(() => toolCall(item().line));
  const input = computed(() => call.value.input);
  const method = computed(() => str(input.value, "method"));
  const repo = computed(() =>
    repoOf(str(input.value, "owner"), str(input.value, "repo")),
  );
  /** The repo's own name, without its owner, for the inline line. */
  const repoName = computed(() => repo.value.split("/").pop() ?? "");
  const result = computed(() => {
    const r = item().result;
    return r && r.kind !== "error" ? r.text : undefined;
  });
  return {
    call,
    input,
    method,
    repo,
    repoName,
    result,
    num: (key: string) => num(input.value, key),
    str: (key: string) => str(input.value, key),
    issueHref: (n: number, inRepo: string = repo.value) =>
      issueUrl(forge.value, n, inRepo || forge.value.repo),
    milestoneHref: (id: number, inRepo: string = repo.value) =>
      milestoneUrl(forge.value, id, inRepo || forge.value.repo),
  };
}
