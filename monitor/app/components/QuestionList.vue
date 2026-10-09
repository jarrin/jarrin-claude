<script setup lang="ts">
import type { Question } from "#shared/protocol";
import { clock } from "~/utils/instances";
import { markdownPlugins } from "~/utils/markdown";

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
  <UCard :ui="{ header: 'px-4 py-2 sm:px-4', body: 'p-4 sm:p-4' }">
    <template #header>
      <h2
        class="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase"
      >
        Open questions
        <UBadge
          v-if="questions.length"
          :label="String(questions.length)"
          color="warning"
          size="sm"
        />
      </h2>
    </template>
    <p v-if="questions.length === 0" class="text-sm text-dimmed">
      No open questions.
    </p>
    <article
      v-for="q in questions"
      :key="q.id"
      class="mb-4 grid gap-2 border-b border-default pb-4 last:mb-0 last:border-0 last:pb-0"
    >
      <header class="flex items-baseline gap-1.5 text-sm">
        <span class="text-muted">#{{ q.issue }}</span>
        <span class="min-w-0 flex-1 font-medium">{{ q.title }}</span>
        <span class="text-xs text-dimmed">{{ clock(q.askedAt) }}</span>
      </header>
      <Markdown :value="q.text" :plugins="markdownPlugins" class="text-sm" />
      <UAlert
        v-if="q.answer !== null"
        color="success"
        variant="subtle"
        icon="i-lucide-check"
        title="Answered — the loop resumes the session next"
        :description="q.answer"
      />
      <UChatPrompt
        v-else
        v-model="drafts[q.id]"
        :rows="2"
        variant="subtle"
        placeholder="Your answer… (Enter sends, Shift+Enter for a newline)"
        @submit="submit(q.id)"
      >
        <UChatPromptSubmit
          :disabled="!drafts[q.id]?.trim()"
          label="Answer"
          size="sm"
        />
      </UChatPrompt>
    </article>
  </UCard>
</template>
