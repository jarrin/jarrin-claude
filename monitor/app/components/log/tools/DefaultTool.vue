<script setup lang="ts">
import { toolIcon, type LogItem } from "~/utils/log";
import { toolCall } from "~/utils/tools";
import LogRow from "../LogRow.vue";
import ToolDetails from "../ToolDetails.vue";

/** Fallback for a tool without its own component: name, summary, input + result. */
const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));
</script>

<template>
  <LogRow
    :item="item"
    :icon="toolIcon(call.name)"
    icon-class="text-info"
    :action="call.name"
    collapsible
  >
    <template v-if="call.summary" #inline-result>{{ call.summary }}</template>
    <ToolDetails :item="item" />
  </LogRow>
</template>
