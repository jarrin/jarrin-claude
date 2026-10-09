<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { mcpName, primaryArg, titleCase } from "~/utils/tools";
import LogRow from "../../../LogRow.vue";
import ToolDetails from "../../../ToolDetails.vue";
import RepoRef from "../../../gitea/RepoRef.vue";

/** Fallback for a gitea tool without its own component. */
const props = defineProps<{ item: LogItem }>();
const g = useGiteaCall(() => props.item);
const title = computed(() => {
  const tool = mcpName(g.call.value.name)?.tool ?? g.call.value.name;
  return [titleCase(tool), g.method.value].filter(Boolean).join(" · ");
});
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-coffee"
    icon-class="text-success"
    action="Gitea"
    :title="title"
    title-class="text-success"
    collapsible
  >
    <template #inline-result
      ><RepoRef
        :what="primaryArg(g.input.value)"
        :repo="g.repo.value"
        :repo-name="g.repoName.value"
    /></template>
    <ToolDetails :item="item" />
  </LogRow>
</template>
