<script setup lang="ts">
import { instanceLabel } from "#shared/protocol";
import { boardsOf, questionsOf } from "~/utils/instances";
import type { Notice } from "~/utils/instances";

const activeId = ref<string | null>(null);

const openNotice = (notice: Notice): void => {
  if (notice.instanceId) activeId.value = notice.instanceId;
};
const notifications = useNotifications(openNotice);
const { state, connected, dismiss, answer, control, input } = useMonitor(
  notifications.notify,
);

const instances = computed(() => state.value.instances);
/** Lines seen per tab, for the unread counter on the others. */
const seen = ref<Record<string, number>>({});

const active = computed(
  () => instances.value.find((i) => i.id === activeId.value) ?? null,
);
const boards = computed(() =>
  active.value ? boardsOf(state.value, active.value) : [],
);
const questions = computed(() =>
  active.value ? questionsOf(state.value, active.value) : [],
);

// Open the first tab by default, and fall back when the active one is dismissed.
watch(
  instances,
  (list) => {
    if (!list.some((i) => i.id === activeId.value))
      activeId.value = list[0]?.id ?? null;
    const a = active.value;
    if (a) seen.value[a.id] = a.lines.length;
  },
  { immediate: true },
);

const unread = (id: string, total: number): number =>
  Math.max(0, total - (seen.value[id] ?? 0));
const openQuestions = (id: string): number => {
  const inst = instances.value.find((i) => i.id === id);
  return inst
    ? questionsOf(state.value, inst).filter((q) => q.answer === null).length
    : 0;
};
</script>

<template>
  <div class="shell">
    <header>
      <span class="brand">
        <img src="/icon.svg" alt="" class="logo" />
        claudjar loops
      </span>
      <nav class="tabs">
        <button
          v-for="inst in instances"
          :key="inst.id"
          :class="['tab', { active: inst.id === activeId }]"
          :title="`${inst.repo} · pid ${inst.pid}`"
          @click="activeId = inst.id"
        >
          <span
            :class="[
              'dot',
              inst.online ? (inst.paused ? 'paused' : 'on') : 'off',
            ]"
          />
          {{ instanceLabel(inst) }}
          <span
            v-if="openQuestions(inst.id)"
            class="badge ask"
            title="Open questions"
            >? {{ openQuestions(inst.id) }}</span
          >
          <span
            v-if="inst.id !== activeId && unread(inst.id, inst.lines.length)"
            class="badge"
            >{{ unread(inst.id, inst.lines.length) }}</span
          >
          <span
            v-if="!inst.online && !openQuestions(inst.id)"
            class="close"
            title="Dismiss"
            @click.stop="dismiss(inst.id)"
            >×</span
          >
        </button>
      </nav>
      <button
        v-if="
          notifications.supported.value &&
          notifications.permission.value === 'default'
        "
        class="notify"
        @click="notifications.enable"
      >
        🔔 Enable notifications
      </button>
      <span :class="['conn', connected ? 'on' : 'off']">
        {{ connected ? "live" : "reconnecting…" }}
      </span>
    </header>
    <main v-if="active" class="instance">
      <div class="meta">
        <span>{{ active.repo }}</span>
        <span>{{ active.host }} · pid {{ active.pid }}</span>
        <span
          :class="[
            'status',
            active.online ? (active.paused ? 'paused' : 'on') : 'off',
          ]"
        >
          {{
            active.online
              ? active.paused
                ? `paused — ${active.status}`
                : active.status
              : `offline — ${active.status}`
          }}
        </span>
      </div>
      <div class="split">
        <LogView :key="active.id" :lines="active.lines" />
        <aside class="side">
          <ProgressTree :boards="boards" />
          <QuestionList
            :questions="questions"
            @answer="(id, text) => answer(id, text)"
          />
        </aside>
      </div>
      <ActionBar
        :instance="active"
        @pause="control(active.id, 'pause')"
        @resume="control(active.id, 'resume')"
        @input="(text) => input(active?.id ?? '', text)"
      />
    </main>
    <main v-else class="none">
      No loops connected. Start one with
      <code>claudjar loop &lt;milestone&gt;</code> and
      <code>CLAUDJAR_MONITOR_URL</code> set.
    </main>
  </div>
</template>
