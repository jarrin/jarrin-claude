<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { str, toolCall } from "~/utils/tools";
import LogRow from "../LogRow.vue";
import ToolOutput from "../ToolOutput.vue";

/** WebFetch / WebSearch: the URL (linked) or query as title. */
const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));
const url = computed(() => str(call.value.input, "url"));
const safeUrl = computed(() =>
  /^https?:\/\//.test(url.value) ? url.value : undefined,
);
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-globe"
    icon-class="text-info"
    :action="call.name"
    :title="url || str(call.input, 'query') || call.summary"
    :title-href="safeUrl"
    title-class="text-info"
    :collapsible="Boolean(item.result)"
  >
    <template v-if="str(call.input, 'prompt')" #inline-result>{{
      str(call.input, "prompt")
    }}</template>
    <ToolOutput v-if="item.result" :line="item.result" />
  </LogRow>
</template>
