<script setup lang="ts">
import {
  parseComment,
  parseComments,
  parseIssue,
  parseIssues,
  parseLabels,
  type GiteaIssue,
} from "~/utils/gitea";
import type { LogItem } from "~/utils/log";
import LogRow from "../../../../LogRow.vue";
import ToolOutput from "../../../../ToolOutput.vue";
import CommentList from "../../../../gitea/CommentList.vue";
import IssueCard from "../../../../gitea/IssueCard.vue";
import IssueList from "../../../../gitea/IssueList.vue";
import RepoRef from "../../../../gitea/RepoRef.vue";

/** issue_read: the issue, its comments, labels or dependencies, by method. */
const props = defineProps<{ item: LogItem }>();
const g = useGiteaCall(() => props.item);

const TITLES: Readonly<Record<string, string>> = {
  get: "Read Issue",
  get_comments: "Read Comments",
  get_comment: "Read Comment",
  get_labels: "Read Labels",
  get_blocked_by: "Read Blockers",
  get_blocking: "Read Blocked",
};
const number = computed(() => g.num("issue_number"));
const commentId = computed(() => g.num("comment_id"));

const text = computed(() => g.result.value ?? "");
const issue = computed(() =>
  g.method.value === "get" ? parseIssue(text.value) : undefined,
);
const comments = computed(() => {
  if (g.method.value === "get_comments")
    return parseComments(text.value)?.items;
  const one =
    g.method.value === "get_comment" ? parseComment(text.value) : undefined;
  return one ? [one] : undefined;
});
const labels = computed(() =>
  g.method.value === "get_labels" ? parseLabels(text.value) : undefined,
);
const deps = computed(() =>
  g.method.value.startsWith("get_block") ? parseIssues(text.value) : undefined,
);
const depHref = (i: GiteaIssue) =>
  g.issueHref(i.number, i.repository ?? g.repo.value);
</script>

<template>
  <LogRow
    :item="item"
    :icon="
      g.method.value.includes('comment')
        ? 'i-lucide-message-square'
        : 'i-lucide-circle-dot'
    "
    icon-class="text-success"
    action="Gitea"
    :title="TITLES[g.method.value] ?? 'Read Issue'"
    title-class="text-success"
    :collapsible="Boolean(item.result)"
  >
    <template #inline-result
      ><RepoRef
        :what="
          number !== undefined
            ? `#${number}`
            : commentId !== undefined
              ? `comment ${commentId}`
              : ''
        "
        :href="number === undefined ? undefined : g.issueHref(number)"
        :repo="g.repo.value"
        :repo-name="g.repoName.value"
    /></template>
    <IssueCard
      v-if="issue"
      :issue="issue"
      :href="g.issueHref(issue.number)"
      :milestone-href="
        issue.milestone ? g.milestoneHref(issue.milestone.id) : undefined
      "
    />
    <CommentList v-else-if="comments" :comments="comments" />
    <div v-else-if="labels" class="flex flex-wrap gap-1">
      <span v-if="labels.items.length === 0" class="text-dimmed"
        >No labels.</span
      >
      <UBadge
        v-for="l in labels.items"
        :key="l.id"
        :label="l.name"
        color="neutral"
        variant="outline"
        size="sm"
      />
    </div>
    <IssueList v-else-if="deps" :list="deps" :href="depHref" />
    <ToolOutput v-else-if="item.result" :line="item.result" />
  </LogRow>
</template>
