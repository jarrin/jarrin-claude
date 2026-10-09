<script setup lang="ts">
import type { Board, EntryStatus } from "#shared/protocol";

defineProps<{ boards: readonly Board[] }>();

const STATUS: Record<EntryStatus, { icon: string; class: string }> = {
  open: { icon: "i-lucide-circle", class: "text-dimmed" },
  working: {
    icon: "i-lucide-loader-circle",
    class: "text-primary animate-spin",
  },
  waiting: { icon: "i-lucide-circle-help", class: "text-warning" },
  blocked: { icon: "i-lucide-circle-x", class: "text-error" },
  closed: { icon: "i-lucide-circle-check", class: "text-success" },
};

const done = (b: Board): number =>
  b.entries.filter((e) => e.status === "closed").length;
</script>

<template>
  <UCard :ui="{ header: 'px-4 py-2 sm:px-4', body: 'p-4 sm:p-4' }">
    <template #header>
      <h2 class="text-xs font-semibold tracking-wide text-muted uppercase">
        Progress
      </h2>
    </template>
    <p v-if="boards.length === 0" class="text-sm text-dimmed">
      Nothing tracked yet.
    </p>
    <div v-for="b in boards" :key="b.milestone.id" class="mb-4 last:mb-0">
      <div class="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span class="font-medium">{{ b.milestone.title }}</span>
        <span class="text-xs text-muted"
          >{{ done(b) }}/{{ b.entries.length }}</span
        >
      </div>
      <UProgress
        :model-value="done(b)"
        :max="Math.max(b.entries.length, 1)"
        size="xs"
        class="mb-2"
      />
      <ul class="grid gap-1 text-sm">
        <li v-for="e in b.entries" :key="e.number">
          <div class="flex items-start gap-1.5">
            <UIcon
              :name="STATUS[e.status].icon"
              :class="['mt-0.5 size-4 shrink-0', STATUS[e.status].class]"
            />
            <span class="text-muted">#{{ e.number }}</span>
            <span
              :class="[
                'min-w-0 flex-1',
                { 'text-muted line-through': e.status === 'closed' },
              ]"
              >{{ e.title }}</span
            >
            <UBadge
              v-if="e.stashed"
              label="stashed"
              color="warning"
              variant="subtle"
              size="sm"
              title="Uncommitted work stashed"
            />
          </div>
          <ul
            v-if="e.steps.length && e.status !== 'closed'"
            class="mt-1 ml-6 grid gap-0.5 text-xs"
          >
            <li
              v-for="(s, i) in e.steps"
              :key="i"
              class="flex items-start gap-1.5"
            >
              <UIcon
                :name="s.done ? 'i-lucide-square-check' : 'i-lucide-square'"
                :class="[
                  'mt-px size-3.5 shrink-0',
                  s.done ? 'text-success' : 'text-dimmed',
                ]"
              />
              <span :class="s.done ? 'text-muted' : 'text-default'">{{
                s.text
              }}</span>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </UCard>
</template>
