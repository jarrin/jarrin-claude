<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import LogRow from "../LogRow.vue";
import ToolOutput from "../ToolOutput.vue";

/**
 * Output whose call is unknown (lines from before calls were paired), or an
 * error of the run itself — a one-liner shows inline, anything longer folds.
 */
const props = defineProps<{ item: LogItem }>();
const error = computed(() => props.item.line.kind === "error");
const short = computed(
  () =>
    !props.item.line.text.includes("\n") && props.item.line.text.length < 160,
);
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-corner-down-right"
    :action="short ? '' : error ? 'error output' : 'output'"
    :collapsible="!short"
    :wrap="short"
  >
    <template v-if="short" #inline-result
      ><span :class="error ? 'text-error' : 'text-muted'">{{
        item.line.text
      }}</span></template
    >
    <ToolOutput :line="item.line" />
  </LogRow>
</template>
