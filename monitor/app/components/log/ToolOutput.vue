<script setup lang="ts">
import type { LogLine } from "#shared/protocol";
import { parseJson } from "~/utils/json";
import { jsonResultMarkdown } from "~/utils/log";
import { markdownPlugins } from "~/utils/markdown";

/** A tool result, rendered generically: highlighted JSON, a JSON tree, or text. */
const props = defineProps<{ line: LogLine }>();

const markdown = computed(() => jsonResultMarkdown(props.line.text));
const json = computed(() => parseJson(props.line.text));
const failed = computed(() => props.line.kind === "error");
</script>

<template>
  <Markdown v-if="markdown" :value="markdown" :plugins="markdownPlugins" />
  <JsonNode v-else-if="json !== undefined" :value="json" />
  <pre
    v-else
    :class="[
      'whitespace-pre-wrap break-all',
      failed ? 'text-error' : 'text-muted',
    ]"
    >{{ line.text }}</pre>
</template>
