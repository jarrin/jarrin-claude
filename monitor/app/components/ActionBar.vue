<script setup lang="ts">
import type { InstanceView } from "#shared/protocol";
import { loopRunning } from "~/utils/projects";

const props = defineProps<{ instance: InstanceView }>();
const emit = defineEmits<{
  pause: [];
  resume: [];
  /** Abort the loop: its session ends and its work is stashed. */
  stop: [];
  input: [text: string];
}>();
const running = computed(() => loopRunning(props.instance));

const draft = ref("");

const send = (): void => {
  const text = draft.value.trim();
  if (!text || !props.instance.online) return;
  emit("input", text);
  draft.value = "";
};
</script>

<template>
  <footer
    class="flex flex-wrap items-end gap-2 border-t border-default bg-default p-3"
  >
    <UButton
      v-if="instance.paused"
      icon="i-lucide-play"
      label="Continue"
      title="Start sessions again (pause holds the loop; it does not abort it)"
      :disabled="!running"
      @click="emit('resume')"
    />
    <UButton
      v-else
      icon="i-lucide-pause"
      label="Pause"
      color="neutral"
      variant="subtle"
      :disabled="!running"
      title="Finish the current session, then start no new one until resumed"
      @click="emit('pause')"
    />
    <ConfirmButton
      icon="i-lucide-square"
      label="Abort"
      color="warning"
      title="Abort the loop?"
      description="The running session ends, its uncommitted work is stashed, the locks are released and the loop exits with status “aborted”. Restarting the loop resumes that session."
      hint="End the loop now (pause only holds it between sessions)"
      :disabled="!running"
      @confirm="emit('stop')"
    />
    <UChatPrompt
      v-model="draft"
      :rows="1"
      :disabled="!instance.online"
      variant="subtle"
      class="min-w-64 flex-1"
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
