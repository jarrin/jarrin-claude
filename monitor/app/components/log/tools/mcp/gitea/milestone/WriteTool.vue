<script setup lang="ts">
import { parseMessage, parseMilestone } from "~/utils/gitea";
import type { LogItem } from "~/utils/log";
import { titleCase } from "~/utils/tools";
import LogRow from "../../../../LogRow.vue";
import ToolDetails from "../../../../ToolDetails.vue";
import MilestoneCard from "../../../../gitea/MilestoneCard.vue";
import RepoRef from "../../../../gitea/RepoRef.vue";

/** milestone_write: the milestone as it stands after the change. */
const props = defineProps<{ item: LogItem }>();
const g = useGiteaCall(() => props.item);
const id = computed(() => g.num("id"));
/** `edit` is an alias of `update`. */
const verb = computed(() =>
  g.method.value === "edit" ? "update" : g.method.value,
);
const milestone = computed(() =>
  g.result.value === undefined ? undefined : parseMilestone(g.result.value),
);
const message = computed(() =>
  g.result.value === undefined ? undefined : parseMessage(g.result.value),
);
const what = computed(() => {
  if (verb.value === "create") return g.str("title");
  const state = g.str("state") ? ` → ${g.str("state")}` : "";
  return id.value === undefined ? state : `ID ${String(id.value)}${state}`;
});
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-milestone"
    icon-class="text-warning"
    action="Gitea"
    :title="`${titleCase(verb || 'write')} Milestone`"
    title-class="text-warning"
    collapsible
  >
    <template #inline-result
      ><RepoRef
        :what="what"
        :href="
          id !== undefined && verb !== 'delete'
            ? g.milestoneHref(id)
            : undefined
        "
        :repo="g.repo.value"
        :repo-name="g.repoName.value"
    /></template>
    <MilestoneCard
      v-if="milestone"
      :milestone="milestone"
      :href="g.milestoneHref(milestone.id)"
    />
    <span v-else-if="message" class="text-success">{{ message }}</span>
    <ToolDetails v-else :item="item" />
  </LogRow>
</template>
