<script setup lang="ts">
import { basename, terminalText, type LiveTail } from "~/utils/log";

/**
 * The live output of a command that writes to a file: open while it runs,
 * scrolled to its end, and folded away (still there to reopen) once it is done.
 */
const props = defineProps<{ tail: LiveTail }>();

const open = ref(!props.tail.done);
watch(
  () => props.tail.done,
  (done) => {
    if (done) open.value = false;
  },
);

const text = computed(() => terminalText(props.tail.text).replace(/\n$/, ""));
const lineCount = computed(() =>
  text.value ? text.value.split("\n").length : 0,
);

const box = ref<HTMLElement | null>(null);
/** Follow the end while the reader has not scrolled up. */
const follow = ref(true);
const onScroll = (): void => {
  const el = box.value;
  if (el) follow.value = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
};
const toEnd = async (): Promise<void> => {
  await nextTick();
  const el = box.value;
  if (el && follow.value) el.scrollTop = el.scrollHeight;
};
watch(text, toEnd);
watch(open, (o) => {
  if (o) {
    follow.value = true;
    void toEnd();
  }
});
onMounted(toEnd);
</script>

<template>
  <div class="pl-5">
    <button
      type="button"
      class="flex items-center gap-1.5 text-dimmed hover:text-default"
      :title="tail.file"
      @click="open = !open"
    >
      <UIcon
        :name="tail.done ? 'i-lucide-scroll-text' : 'i-lucide-loader-circle'"
        :class="['size-3.5', tail.done ? '' : 'animate-spin text-info']"
      />
      <span>{{ tail.done ? "log" : "live" }}</span>
      <span class="text-muted">{{ basename(tail.file) }}</span>
      <span>· {{ lineCount }} lines</span>
      <UIcon
        name="i-lucide-chevron-down"
        :class="['size-3.5 transition-transform', open && 'rotate-180']"
      />
    </button>
    <UCollapsible v-model:open="open" unmount-on-hide>
      <template #content>
        <pre
          ref="box"
          class="mt-1 max-h-72 overflow-auto rounded border border-default bg-elevated/40 p-2 whitespace-pre-wrap break-all text-muted"
          @scroll="onScroll"
          >{{ text || "(nothing written yet)" }}</pre>
      </template>
    </UCollapsible>
  </div>
</template>
