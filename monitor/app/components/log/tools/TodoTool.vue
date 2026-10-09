<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import { toolCall } from "~/utils/tools";
import LogRow from "../LogRow.vue";

interface Todo {
  readonly content: string;
  readonly status: string;
}

/** TodoWrite: the checklist itself, with its progress as title. */
const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));
const todos = computed((): Todo[] => {
  const list = call.value.input.todos;
  if (!Array.isArray(list)) return [];
  return list.flatMap((t) =>
    t !== null &&
    typeof t === "object" &&
    !Array.isArray(t) &&
    typeof t.content === "string"
      ? [
          {
            content: t.content,
            status: typeof t.status === "string" ? t.status : "pending",
          },
        ]
      : [],
  );
});
const done = computed(
  () => todos.value.filter((t) => t.status === "completed").length,
);
const current = computed(
  () => todos.value.find((t) => t.status === "in_progress")?.content ?? "",
);
const ICON: Readonly<Record<string, string>> = {
  completed: "i-lucide-square-check",
  in_progress: "i-lucide-square-dot",
};
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-list-checks"
    icon-class="text-info"
    action="Todos"
    :title="`${done}/${todos.length}`"
    :collapsible="todos.length > 0"
  >
    <template v-if="current" #inline-result>{{ current }}</template>
    <ul class="grid gap-0.5 font-sans text-xs">
      <li v-for="(t, i) in todos" :key="i" class="flex items-start gap-1.5">
        <UIcon
          :name="ICON[t.status] ?? 'i-lucide-square'"
          :class="[
            'mt-px size-3.5 shrink-0',
            t.status === 'completed'
              ? 'text-success'
              : t.status === 'in_progress'
                ? 'text-primary'
                : 'text-dimmed',
          ]"
        />
        <span
          :class="t.status === 'completed' ? 'text-muted line-through' : ''"
          >{{ t.content }}</span
        >
      </li>
    </ul>
  </LogRow>
</template>
