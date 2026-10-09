<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { markdownPlugins } from "~/utils/markdown";
import LogRow from "../LogRow.vue";

/** Assistant text, or the end-of-session summary: rendered Markdown, inline. */
const props = defineProps<{ item: LogItem }>();
const summary = computed(() => props.item.line.kind === "result");
</script>

<template>
  <LogRow
    :item="item"
    :icon="summary ? 'i-lucide-flag' : 'i-lucide-message-square'"
    :icon-class="summary ? 'text-success' : 'text-muted'"
    wrap
  >
    <template #inline-result>
      <Markdown
        :value="item.line.text"
        :plugins="markdownPlugins"
        :class="[
          'font-sans text-sm',
          summary ? 'text-success' : 'text-default',
        ]"
      />
    </template>
  </LogRow>
</template>
