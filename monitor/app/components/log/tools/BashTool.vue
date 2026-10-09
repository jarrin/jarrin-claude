<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { str, toolCall } from "~/utils/tools";
import LiveTail from "../LiveTail.vue";
import LogRow from "../LogRow.vue";
import ToolDetails from "../ToolDetails.vue";

const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));
const command = computed(
  () => str(call.value.input, "command") || call.value.summary,
);
/** The first line of the command; the rest is in the body. */
const head = computed(() => command.value.split("\n")[0] ?? "");
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-terminal"
    icon-class="text-info"
    action="Bash"
    collapsible
  >
    <template #inline-result
      ><span class="text-default">{{ head }}</span></template
    >
    <template v-if="item.tail" #live><LiveTail :tail="item.tail" /></template>
    <ToolDetails :item="item" />
  </LogRow>
</template>
