<script setup lang="ts">
import type { LogLine } from "#shared/protocol";

const props = defineProps<{ lines: readonly LogLine[] }>();

const box = ref<HTMLElement | null>(null);
/** Stick to the bottom until the reader scrolls up; scrolling back down re-arms it. */
const follow = ref(true);

const onScroll = (): void => {
  const el = box.value;
  if (el) follow.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
};

const toBottom = (): void => {
  const el = box.value;
  if (el) el.scrollTop = el.scrollHeight;
};

watch(
  () => props.lines,
  async () => {
    if (!follow.value) return;
    await nextTick();
    toBottom();
  },
);
onMounted(toBottom);
</script>

<template>
  <div class="log-wrap">
    <div ref="box" class="log" @scroll="onScroll">
      <div v-if="lines.length === 0" class="empty">No output yet.</div>
      <LogEntry v-for="(line, i) in lines" :key="i" :line="line" />
    </div>
    <button
      v-if="!follow"
      class="follow"
      @click="
        follow = true;
        toBottom();
      "
    >
      ↓ follow
    </button>
  </div>
</template>
