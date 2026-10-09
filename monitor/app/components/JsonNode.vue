<script setup lang="ts">
import { isProse, renderMarkdown, type JsonValue } from "~/utils/render";

const props = defineProps<{ value: JsonValue }>();

const entries = computed((): [string, JsonValue][] => {
  const v = props.value;
  if (Array.isArray(v)) return v.map((x, i) => [String(i), x]);
  if (v !== null && typeof v === "object") return Object.entries(v);
  return [];
});
const isList = computed(() => Array.isArray(props.value));
const isContainer = computed(
  () => props.value !== null && typeof props.value === "object",
);
/** Sanitised HTML for a prose string; empty for everything else. */
const prose = computed(() =>
  typeof props.value === "string" && isProse(props.value)
    ? renderMarkdown(props.value)
    : "",
);
</script>

<template>
  <div v-if="isContainer" :class="['json', isList ? 'list' : 'obj']">
    <div v-if="entries.length === 0" class="json-empty">
      {{ isList ? "[]" : "{}" }}
    </div>
    <div v-for="[key, child] in entries" :key="key" class="json-row">
      <span class="json-key">{{ isList ? `#${key}` : key }}</span>
      <JsonNode :value="child" />
    </div>
  </div>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitised by renderMarkdown -->
  <div v-else-if="prose" class="md" v-html="prose" />
  <span v-else :class="['json-scalar', value === null ? 'null' : typeof value]">
    {{ value === null ? "null" : String(value) }}
  </span>
</template>
