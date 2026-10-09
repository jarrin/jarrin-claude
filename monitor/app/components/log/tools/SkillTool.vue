<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { str, toolCall } from "~/utils/tools";
import LogRow from "../LogRow.vue";

/** A skill launch says all it has to in one line: the skill and its arguments. */
const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-sparkles"
    icon-class="text-primary"
    action="Skill"
    :title="str(call.input, 'skill') || call.summary"
    title-class="text-primary"
  >
    <template v-if="str(call.input, 'args')" #inline-result
      ><span class="text-default">{{ str(call.input, "args") }}</span></template
    >
  </LogRow>
</template>
