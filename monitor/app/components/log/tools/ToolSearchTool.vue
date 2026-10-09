<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { selectedTools, str, toolCall, toolLabel } from "~/utils/tools";
import LogRow from "../LogRow.vue";
import ToolOutput from "../ToolOutput.vue";

/** Loading deferred tools: `select:` lists them, a keyword search shows its matches. */
const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));
const query = computed(
  () => str(call.value.input, "query") || call.value.summary,
);
const selected = computed(() => selectedTools(query.value));
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-package-search"
    icon-class="text-secondary"
    action="ToolSearch"
    :title="selected.length ? 'Select' : 'Search'"
    title-class="text-secondary"
    :collapsible="selected.length > 0 || Boolean(item.result)"
  >
    <template #inline-result>{{
      selected.length
        ? `${selected.length} tool${selected.length === 1 ? "" : "s"}`
        : query
    }}</template>
    <div v-if="selected.length" class="flex flex-wrap gap-1">
      <UBadge
        v-for="name in selected"
        :key="name"
        :label="toolLabel(name)"
        :title="name"
        color="neutral"
        variant="subtle"
        size="sm"
      />
    </div>
    <ToolOutput v-else-if="item.result" :line="item.result" />
  </LogRow>
</template>
