<script setup lang="ts">
import type { InstanceView } from "#shared/protocol";

const props = defineProps<{ instance: InstanceView }>();
const emit = defineEmits<{
  pause: [];
  resume: [];
  input: [text: string];
}>();

const draft = ref("");

const send = (): void => {
  const text = draft.value.trim();
  if (!text || !props.instance.online) return;
  emit("input", text);
  draft.value = "";
};
</script>

<template>
  <footer class="flex items-end gap-2 border-t border-default bg-default p-3">
    <UButton
      v-if="instance.paused"
      icon="i-lucide-play"
      label="Resume"
      :disabled="!instance.online"
      @click="emit('resume')"
    />
    <UButton
      v-else
      icon="i-lucide-pause"
      label="Pause"
      color="neutral"
      variant="subtle"
      :disabled="!instance.online"
      title="Finish the current session, then start no new one until resumed"
      @click="emit('pause')"
    />
    <UChatPrompt
      v-model="draft"
      :rows="1"
      :disabled="!instance.online"
      variant="subtle"
      class="flex-1"
      placeholder="Send input to the running session (or the next one, when idle)…"
      @submit="send"
    >
      <UChatPromptSubmit
        :disabled="!instance.online || !draft.trim()"
        size="sm"
      />
    </UChatPrompt>
  </footer>
</template>
