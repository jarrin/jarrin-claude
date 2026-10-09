<script setup lang="ts">
import type { Question } from "#shared/protocol";
import { clock } from "~/utils/instances";

defineProps<{ questions: readonly Question[] }>();
const emit = defineEmits<{ answer: [questionId: string, text: string] }>();

const drafts = ref<Record<string, string>>({});

const submit = (id: string): void => {
  const text = drafts.value[id]?.trim();
  if (!text) return;
  emit("answer", id, text);
  drafts.value[id] = "";
};
</script>

<template>
  <section class="panel questions">
    <h2>
      Open questions
      <span v-if="questions.length" class="count">{{ questions.length }}</span>
    </h2>
    <div v-if="questions.length === 0" class="empty">No open questions.</div>
    <article v-for="q in questions" :key="q.id" class="question">
      <header>
        <span class="num">#{{ q.issue }}</span> {{ q.title }}
        <span class="time">{{ clock(q.askedAt) }}</span>
      </header>
      <p class="text">{{ q.text }}</p>
      <div v-if="q.answer !== null" class="answered">
        <span class="label">Answered — the loop resumes the session next:</span>
        <p>{{ q.answer }}</p>
      </div>
      <form v-else @submit.prevent="submit(q.id)">
        <textarea
          :id="`answer-${q.id}`"
          v-model="drafts[q.id]"
          rows="3"
          placeholder="Your answer… (Ctrl+Enter sends)"
          @keydown.enter.ctrl.prevent="submit(q.id)"
        />
        <button type="submit" :disabled="!drafts[q.id]?.trim()">Answer</button>
      </form>
    </article>
  </section>
</template>
