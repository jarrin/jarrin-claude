<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { entryComponent } from "./log/registry";

/** One log entry, rendered by the component registered for its tool or kind. */
const props = defineProps<{ item: LogItem }>();
const component = computed(() => entryComponent(props.item));
</script>

<template>
  <component :is="component" :item="item" />
</template>
