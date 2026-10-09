<script setup lang="ts">
import { isProse, type JsonValue } from "~/utils/json";
import { markdownPlugins } from "~/utils/markdown";

const props = defineProps<{ value: JsonValue; nested?: boolean }>();

const isList = computed(() => Array.isArray(props.value));
const entries = computed((): [string, JsonValue][] => {
  const v = props.value;
  if (Array.isArray(v)) return v.map((x, i) => [`#${String(i)}`, x]);
  if (v !== null && typeof v === "object") return Object.entries(v);
  return [];
});
const scalarClass = computed(() => {
  const v = props.value;
  if (v === null) return "text-dimmed";
  if (typeof v === "number" || typeof v === "boolean") return "text-warning";
  return "text-default";
});
</script>

<template>
  <div
    v-if="value !== null && typeof value === 'object'"
    :class="['grid gap-0.5', { 'border-l border-default pl-2.5': nested }]"
  >
    <span v-if="entries.length === 0" class="text-dimmed">
      {{ isList ? "[]" : "{}" }}
    </span>
    <div
      v-for="[key, child] in entries"
      :key="key"
      class="grid grid-cols-[minmax(3em,max-content)_1fr] items-baseline gap-2"
    >
      <span class="text-info">{{ key }}</span>
      <JsonNode :value="child" nested />
    </div>
  </div>
  <Markdown
    v-else-if="typeof value === 'string' && isProse(value)"
    :value="value"
    :plugins="markdownPlugins"
    class="font-sans text-sm"
  />
  <span v-else :class="scalarClass">{{
    value === null ? "null" : String(value)
  }}</span>
</template>
