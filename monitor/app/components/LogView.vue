<script setup lang="ts">
import type { LogLine } from "#shared/protocol";
import { groupLines } from "~/utils/log";

const props = defineProps<{ lines: readonly LogLine[] }>();

const items = computed(() => groupLines(props.lines));

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
  <div class="relative min-h-0 flex-1">
    <div ref="box" class="h-full overflow-y-auto py-2" @scroll="onScroll">
      <div v-if="items.length === 0" class="px-3 text-dimmed">
        No output yet.
      </div>
      <LogEntry v-for="(item, i) in items" :key="i" :item="item" />
    </div>
    <UButton
      v-if="!follow"
      class="absolute right-4 bottom-4"
      color="neutral"
      variant="subtle"
      size="sm"
      icon="i-lucide-arrow-down"
      label="Follow"
      @click="
        follow = true;
        toBottom();
      "
    />
  </div>
</template>
