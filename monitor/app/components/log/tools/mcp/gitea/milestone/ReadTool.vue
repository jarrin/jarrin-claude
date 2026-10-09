<script setup lang="ts">
import { parseMilestone, parseMilestones } from "~/utils/gitea";
import type { LogItem } from "~/utils/log";
import LogRow from "../../../../LogRow.vue";
import ToolOutput from "../../../../ToolOutput.vue";
import MilestoneCard from "../../../../gitea/MilestoneCard.vue";
import RepoRef from "../../../../gitea/RepoRef.vue";

/** milestone_read: `get` shows the milestone, `list` every milestone found. */
const props = defineProps<{ item: LogItem }>();
const g = useGiteaCall(() => props.item);
const id = computed(() => g.num("id"));
const one = computed(() =>
  g.result.value === undefined ? undefined : parseMilestone(g.result.value),
);
const list = computed(() =>
  g.result.value === undefined ? undefined : parseMilestones(g.result.value),
);
const filter = computed(() =>
  [
    g.str("state") && g.str("state") !== "all" ? g.str("state") : "",
    g.str("name"),
  ]
    .filter(Boolean)
    .join(" "),
);
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-milestone"
    icon-class="text-success"
    action="Gitea"
    :title="g.method.value === 'list' ? 'List Milestones' : 'Read Milestone'"
    title-class="text-success"
    :collapsible="Boolean(item.result)"
  >
    <template #inline-result
      ><RepoRef
        :what="
          g.method.value === 'list'
            ? filter
            : id === undefined
              ? ''
              : `ID ${id}`
        "
        :href="id === undefined ? undefined : g.milestoneHref(id)"
        :repo="g.repo.value"
        :repo-name="g.repoName.value"
    /></template>
    <MilestoneCard
      v-if="one"
      :milestone="one"
      :href="g.milestoneHref(one.id)"
    />
    <div v-else-if="list" class="grid gap-3">
      <p v-if="list.items.length === 0" class="text-dimmed">No milestones.</p>
      <MilestoneCard
        v-for="m in list.items"
        :key="m.id"
        :milestone="m"
        :href="g.milestoneHref(m.id)"
      />
      <p v-if="list.more" class="text-dimmed">… {{ list.more }} more</p>
    </div>
    <ToolOutput v-else-if="item.result" :line="item.result" />
  </LogRow>
</template>
