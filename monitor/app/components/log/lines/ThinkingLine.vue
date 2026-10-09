<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { markdownPlugins } from "~/utils/markdown";
import LogRow from "../LogRow.vue";

/** Thinking: its first line inline, the whole of it behind the toggle. */
const props = defineProps<{ item: LogItem }>();
const head = computed(() => props.item.line.text.split("\n")[0] ?? "");
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-brain"
    icon-class="text-secondary"
    action="Thinking"
    collapsible
  >
    <template #inline-result>{{ head }}</template>
    <Markdown
      :value="item.line.text"
      :plugins="markdownPlugins"
      class="font-sans text-sm text-muted"
    />
  </LogRow>
</template>
