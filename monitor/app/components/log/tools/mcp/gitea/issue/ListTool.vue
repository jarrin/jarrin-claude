<script setup lang="ts">
import { parseIssues, type GiteaIssue } from "~/utils/gitea";
import type { LogItem } from "~/utils/log";
import { mcpName } from "~/utils/tools";
import LogRow from "../../../../LogRow.vue";
import ToolOutput from "../../../../ToolOutput.vue";
import IssueList from "../../../../gitea/IssueList.vue";
import RepoRef from "../../../../gitea/RepoRef.vue";

/** list_issues / search_issues: the filters inline, the issues found as body. */
const props = defineProps<{ item: LogItem }>();
const g = useGiteaCall(() => props.item);

const search = computed(
  () => mcpName(g.call.value.name)?.tool === "search_issues",
);
const list = (key: string): string => {
  const v = g.input.value[key];
  return Array.isArray(v) ? v.map(String).join(", ") : "";
};
const filters = computed(() =>
  [
    g.str("query") && `“${g.str("query")}”`,
    g.str("state") && g.str("state") !== "all" ? g.str("state") : "",
    g.str("type") === "pulls" ? "pulls" : "",
    list("labels") && `labels ${list("labels")}`,
    list("milestones") && `milestone ${list("milestones")}`,
    g.str("assigned_by") && `assigned ${g.str("assigned_by")}`,
  ]
    .filter(Boolean)
    .join(" · "),
);
const issues = computed(() =>
  g.result.value === undefined ? undefined : parseIssues(g.result.value),
);
const href = (i: GiteaIssue) =>
  g.issueHref(i.number, i.repository ?? g.repo.value);
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-list-filter"
    icon-class="text-success"
    action="Gitea"
    :title="search ? 'Search Issues' : 'List Issues'"
    title-class="text-success"
    :collapsible="Boolean(item.result)"
  >
    <template #inline-result
      ><RepoRef
        :what="
          issues
            ? `${issues.items.length + issues.more} found${filters ? ` · ${filters}` : ''}`
            : filters
        "
        :repo="g.repo.value"
        :repo-name="g.repoName.value"
    /></template>
    <IssueList v-if="issues" :list="issues" :href="href" />
    <ToolOutput v-else-if="item.result" :line="item.result" />
  </LogRow>
</template>
