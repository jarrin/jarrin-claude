<script setup lang="ts">
import { toolIcon, type LogItem } from "~/utils/log";
import { str, toolCall } from "~/utils/tools";
import LogRow from "../LogRow.vue";
import ToolOutput from "../ToolOutput.vue";

/** Grep / Glob: the pattern as title, where it looked inline, the matches as body. */
const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));
const where = computed(() =>
  [
    str(call.value.input, "path") && `in ${str(call.value.input, "path")}`,
    str(call.value.input, "glob") && `glob ${str(call.value.input, "glob")}`,
    str(call.value.input, "type") && `type ${str(call.value.input, "type")}`,
  ]
    .filter(Boolean)
    .join(" · "),
);
</script>

<template>
  <LogRow
    :item="item"
    :icon="toolIcon(call.name)"
    icon-class="text-info"
    :action="call.name"
    :title="str(call.input, 'pattern') || call.summary"
    title-class="text-warning"
    :collapsible="Boolean(item.result)"
  >
    <template v-if="where" #inline-result>{{ where }}</template>
    <ToolOutput v-if="item.result" :line="item.result" />
  </LogRow>
</template>
