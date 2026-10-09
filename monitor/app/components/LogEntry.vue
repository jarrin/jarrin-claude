<script setup lang="ts">
import type { LogLine } from "#shared/protocol";
import { clock } from "~/utils/instances";
import { MARKDOWN_KINDS, parseJson, renderMarkdown } from "~/utils/render";

const props = defineProps<{ line: LogLine }>();

const json = computed(() =>
  props.line.kind === "output" || props.line.kind === "error"
    ? parseJson(props.line.text)
    : undefined,
);
const html = computed(() =>
  MARKDOWN_KINDS.has(props.line.kind) ? renderMarkdown(props.line.text) : "",
);

/** Structured output starts folded; a click on the fold opens it. */
const open = ref(false);
</script>

<template>
  <div :class="['line', line.kind]">
    <span class="time">{{ clock(line.t) }}</span>
    <span class="issue">{{ line.issue ? `#${line.issue}` : "" }}</span>
    <div v-if="json !== undefined" :class="['text', 'fold', { open }]">
      <JsonNode :value="json" />
      <button class="fold-toggle" @click="open = !open">
        {{ open ? "▴ collapse" : "▾ expand" }}
      </button>
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -- sanitised by renderMarkdown -->
    <div v-else-if="html" class="text md" v-html="html" />
    <span v-else class="text">{{ line.text }}</span>
  </div>
</template>
