<script setup lang="ts">
import { inputMarkdown, type LogItem } from "~/utils/log";
import { fence, markdownPlugins } from "~/utils/markdown";
import ToolOutput from "./ToolOutput.vue";

/** The generic body of a tool call: its input, highlighted, then its result. */
const props = withDefaults(defineProps<{ item: LogItem; input?: boolean }>(), {
  input: true,
});

const markdown = computed(() => {
  const d = props.item.line.detail;
  if (!props.input) return "";
  if (d?.type === "command") return fence("bash", d.command);
  if (d?.type === "input") return inputMarkdown(d.json);
  return "";
});
</script>

<template>
  <Markdown v-if="markdown" :value="markdown" :plugins="markdownPlugins" />
  <ToolOutput v-if="item.result" :line="item.result" />
</template>
