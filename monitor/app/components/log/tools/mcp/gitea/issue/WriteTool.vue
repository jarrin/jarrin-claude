<script setup lang="ts">
import { parseIssue, parseLabels } from "~/utils/gitea";
import type { LogItem } from "~/utils/log";
import { markdownPlugins } from "~/utils/markdown";
import { titleCase } from "~/utils/tools";
import LogRow from "../../../../LogRow.vue";
import ToolDetails from "../../../../ToolDetails.vue";
import IssueCard from "../../../../gitea/IssueCard.vue";
import RepoRef from "../../../../gitea/RepoRef.vue";

/** issue_write: the issue after a create / update, the comment written, labels. */
const props = defineProps<{ item: LogItem }>();
const g = useGiteaCall(() => props.item);

const number = computed(() => g.num("issue_number"));
const isComment = computed(() => g.method.value.endsWith("_comment"));
const title = computed(() => {
  const m = g.method.value;
  if (m === "create" || m === "update") return `${titleCase(m)} Issue`;
  return titleCase(m || "write issue");
});
const what = computed(() => {
  if (g.method.value === "create") return `“${g.str("title")}”`;
  const n = number.value === undefined ? "" : `#${String(number.value)}`;
  const related = g.num("related_issue_number");
  if (g.method.value.endsWith("_dependency") && related !== undefined)
    return `${n} ${g.str("dependency_type") || "→"} #${String(related)}`;
  return g.str("state") ? `${n} → ${g.str("state")}` : n;
});
const issue = computed(() =>
  g.result.value === undefined || isComment.value
    ? undefined
    : parseIssue(g.result.value),
);
const labels = computed(() =>
  g.result.value !== undefined && g.method.value.includes("label")
    ? parseLabels(g.result.value)
    : undefined,
);
</script>

<template>
  <LogRow
    :item="item"
    :icon="isComment ? 'i-lucide-message-square-plus' : 'i-lucide-circle-dot'"
    icon-class="text-warning"
    action="Gitea"
    :title="title"
    title-class="text-warning"
    collapsible
  >
    <template #inline-result
      ><RepoRef
        :what="what"
        :href="number === undefined ? undefined : g.issueHref(number)"
        :repo="g.repo.value"
        :repo-name="g.repoName.value"
    /></template>
    <Markdown
      v-if="isComment && g.str('body')"
      :value="g.str('body')"
      :plugins="markdownPlugins"
      class="border-l-2 border-default pl-2 font-sans text-sm"
    />
    <IssueCard
      v-else-if="issue"
      :issue="issue"
      :href="g.issueHref(issue.number)"
      :milestone-href="
        issue.milestone ? g.milestoneHref(issue.milestone.id) : undefined
      "
    />
    <div v-else-if="labels" class="flex flex-wrap gap-1">
      <UBadge
        v-for="l in labels.items"
        :key="l.id"
        :label="l.name"
        color="neutral"
        variant="outline"
        size="sm"
      />
    </div>
    <ToolDetails v-else :item="item" />
  </LogRow>
</template>
