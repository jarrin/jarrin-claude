<script setup lang="ts">
import type { LogKind } from "#shared/protocol";
import type { LogItem } from "~/utils/log";
import LogRow from "../LogRow.vue";
import RefText from "../RefText.vue";

/** The loop's own lines, user input and harness events: one line of text. */
const props = defineProps<{ item: LogItem }>();

const STYLE: Partial<Record<LogKind, { icon: string; class: string }>> = {
  loop: { icon: "i-lucide-repeat", class: "font-semibold text-primary" },
  input: { icon: "i-lucide-mail", class: "text-warning" },
  system: { icon: "i-lucide-info", class: "text-info" },
};
const style = computed(
  () =>
    STYLE[props.item.line.kind] ?? {
      icon: "i-lucide-dot",
      class: "text-default",
    },
);
</script>

<template>
  <LogRow :item="item" :icon="style.icon" :icon-class="style.class" wrap>
    <template #inline-result>
      <span :class="['whitespace-pre-wrap', style.class]"
        ><RefText :text="item.line.text.replace(/^\n+/, '')"
      /></span>
    </template>
  </LogRow>
</template>
