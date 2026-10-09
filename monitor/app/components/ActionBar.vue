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
  <footer class="actions">
    <button
      v-if="instance.paused"
      class="primary"
      :disabled="!instance.online"
      @click="emit('resume')"
    >
      ▶ Resume
    </button>
    <button
      v-else
      :disabled="!instance.online"
      title="Finish the current session, then start no new one until resumed"
      @click="emit('pause')"
    >
      ⏸ Pause
    </button>
    <form class="input" @submit.prevent="send">
      <input
        v-model="draft"
        :disabled="!instance.online"
        placeholder="Send input to the running session (or the next one, when idle)…"
      />
      <button type="submit" :disabled="!instance.online || !draft.trim()">
        Send
      </button>
    </form>
  </footer>
</template>
