<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { markdownPlugins } from "~/utils/markdown";
import { str, toolCall } from "~/utils/tools";
import LogRow from "../LogRow.vue";
import ToolOutput from "../ToolOutput.vue";

/** A subagent: its task as title, the prompt and its (prose) report as body. */
const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));
const prompt = computed(() => str(call.value.input, "prompt"));
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-bot"
    icon-class="text-secondary"
    :action="call.name"
    :title="str(call.input, 'description') || call.summary"
    title-class="text-secondary"
    collapsible
  >
    <template v-if="str(call.input, 'subagent_type')" #inline-result>{{
      str(call.input, "subagent_type")
    }}</template>
    <Markdown
      v-if="prompt"
      :value="prompt"
      :plugins="markdownPlugins"
      class="border-l-2 border-default pl-2 font-sans text-sm text-muted"
    />
    <template v-if="item.result">
      <ToolOutput v-if="item.result.kind === 'error'" :line="item.result" />
      <Markdown
        v-else
        :value="item.result.text"
        :plugins="markdownPlugins"
        class="font-sans text-sm"
      />
    </template>
  </LogRow>
</template>
