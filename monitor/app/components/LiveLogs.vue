<script setup lang="ts">
import type { LiveLog } from "#shared/protocol";
import { clock } from "~/utils/instances";
import { basename, terminalText } from "~/utils/log";

/**
 * Every file a Bash call writes its output to — from plain Claude Code sessions
 * (the PreToolUse hook) and from loops alike — followed live. The list is newest
 * first; until the reader picks one, the most recently active log is shown.
 */
const props = defineProps<{ logs: readonly LiveLog[] }>();
const emit = defineEmits<{ dismiss: [ids: string[]] }>();

const finished = computed(() =>
  props.logs.filter((l) => l.done).map((l) => l.id),
);

const picked = ref<string | null>(null);
const list = computed(() =>
  [...props.logs].sort((a, b) => b.startedAt - a.startedAt),
);
const current = computed(
  () =>
    props.logs.find((l) => l.id === picked.value) ??
    props.logs[props.logs.length - 1] ??
    null,
);

const text = computed(() =>
  current.value ? terminalText(current.value.text).replace(/\n$/, "") : "",
);

const box = ref<HTMLElement | null>(null);
/** Follow the end while the reader has not scrolled up. */
const follow = ref(true);
const onScroll = (): void => {
  const el = box.value;
  if (el) follow.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
};
const toEnd = async (): Promise<void> => {
  await nextTick();
  const el = box.value;
  if (el && follow.value) el.scrollTop = el.scrollHeight;
};
watch(text, toEnd);
watch(
  () => current.value?.id,
  () => {
    follow.value = true;
    void toEnd();
  },
);
onMounted(toEnd);

const where = (log: LiveLog): string =>
  `${basename(log.source.where)} @ ${log.source.host}`;
</script>

<template>
  <div class="flex min-h-0 flex-1">
    <nav
      class="w-80 shrink-0 overflow-y-auto border-r border-default text-xs"
      aria-label="Live logs"
    >
      <div
        v-if="finished.length"
        class="flex justify-end border-b border-default px-3 py-1"
      >
        <UButton
          icon="i-lucide-trash-2"
          :label="`Clear ${finished.length} finished`"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="emit('dismiss', finished)"
        />
      </div>
      <button
        v-for="log in list"
        :key="log.id"
        type="button"
        :class="[
          'flex w-full flex-col gap-0.5 border-b border-default px-3 py-2 text-left hover:bg-elevated/50',
          current?.id === log.id && 'bg-elevated',
        ]"
        :title="log.file"
        @click="picked = log.id"
      >
        <span class="flex items-center gap-1.5">
          <UIcon
            :name="log.done ? 'i-lucide-scroll-text' : 'i-lucide-loader-circle'"
            :class="[
              'size-3.5 shrink-0',
              log.done ? 'text-dimmed' : 'animate-spin text-info',
            ]"
          />
          <span class="truncate font-medium text-default">
            {{ basename(log.file) }}
          </span>
          <span class="ml-auto shrink-0 text-dimmed">
            {{ clock(log.startedAt) }}
          </span>
          <UIcon
            v-if="log.done"
            name="i-lucide-x"
            class="size-3.5 shrink-0 text-dimmed hover:text-default"
            title="Dismiss"
            @click.stop="emit('dismiss', [log.id])"
          />
        </span>
        <span class="flex items-center gap-1.5 text-muted">
          <UBadge
            :label="log.source.kind"
            :color="log.source.kind === 'loop' ? 'primary' : 'neutral'"
            variant="subtle"
            size="sm"
          />
          <span class="truncate">{{ where(log) }}</span>
        </span>
      </button>
      <p v-if="!list.length" class="p-3 text-muted">
        Nothing yet. A Bash call that writes to a file (<code
          >cmd &gt; out.log</code
        >, <code>| tee out.log</code>) shows up here while it runs.
      </p>
    </nav>
    <section v-if="current" class="flex min-w-0 flex-1 flex-col">
      <header
        class="grid gap-1 border-b border-default px-3 py-1.5 text-xs text-muted"
      >
        <span class="flex items-center gap-2">
          <span class="truncate font-mono text-default">{{
            current.file
          }}</span>
          <UBadge
            :label="current.done ? 'done' : 'live'"
            :color="current.done ? 'neutral' : 'success'"
            variant="subtle"
            size="sm"
          />
          <span class="ml-auto shrink-0">
            {{ where(current) }} · {{ current.source.session.slice(0, 8) }}
          </span>
        </span>
        <code v-if="current.command" class="truncate" :title="current.command">
          $ {{ current.command }}
        </code>
      </header>
      <pre
        ref="box"
        class="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap break-all"
        @scroll="onScroll"
        >{{ text || "(nothing written yet)" }}</pre>
    </section>
  </div>
</template>
