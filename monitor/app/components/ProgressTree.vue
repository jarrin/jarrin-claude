<script setup lang="ts">
import type { Board, EntryStatus } from "#shared/protocol";

defineProps<{ boards: readonly Board[] }>();

const ICON: Record<EntryStatus, string> = {
  open: "○",
  working: "◐",
  waiting: "?",
  blocked: "✕",
  closed: "✓",
};

const done = (b: Board): number =>
  b.entries.filter((e) => e.status === "closed").length;
</script>

<template>
  <section class="panel progress">
    <h2>Progress</h2>
    <div v-if="boards.length === 0" class="empty">Nothing tracked yet.</div>
    <div v-for="b in boards" :key="b.milestone.id" class="board">
      <div class="milestone">
        {{ b.milestone.title }}
        <span class="count">{{ done(b) }}/{{ b.entries.length }}</span>
      </div>
      <ul class="tree">
        <li v-for="e in b.entries" :key="e.number" :class="['entry', e.status]">
          <span class="icon" :title="e.status">{{ ICON[e.status] }}</span>
          <span class="num">#{{ e.number }}</span>
          <span class="title">{{ e.title }}</span>
          <span v-if="e.stashed" class="tag" title="Uncommitted work stashed"
            >stashed</span
          >
          <ul v-if="e.steps.length && e.status !== 'closed'" class="steps">
            <li v-for="(s, i) in e.steps" :key="i" :class="{ done: s.done }">
              <span class="box">{{ s.done ? "☑" : "☐" }}</span> {{ s.text }}
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </section>
</template>
