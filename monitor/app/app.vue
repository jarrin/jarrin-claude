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

const tabs = computed(() =>
  instances.value.map((inst) => ({
    label: instanceLabel(inst),
    value: inst.id,
    inst,
  })),
);
const selected = computed({
  get: () => activeId.value ?? undefined,
  set: (id: string | number | undefined) => {
    activeId.value = id === undefined ? null : String(id);
  },
});

const dotClass = (inst: { online: boolean; paused: boolean }): string =>
  inst.online ? (inst.paused ? "bg-warning" : "bg-success") : "bg-dimmed";

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
  <UApp>
    <div class="flex h-dvh flex-col bg-default text-default">
      <header
        class="flex items-center gap-3 border-b border-default bg-elevated/50 px-3"
      >
        <span class="flex items-center gap-2 font-semibold text-primary">
          <img src="/icon.svg" alt="" class="size-5" />
          claudjar loops
        </span>
        <UTabs
          v-model="selected"
          :items="tabs"
          :content="false"
          variant="link"
          size="sm"
          class="min-w-0 flex-1"
          :ui="{ list: 'overflow-x-auto overflow-y-hidden', trigger: 'py-3' }"
        >
          <template #leading="{ item }">
            <span :class="['size-2 rounded-full', dotClass(item.inst)]" />
          </template>
          <template #trailing="{ item }">
            <UBadge
              v-if="openQuestions(item.inst.id)"
              :label="`? ${openQuestions(item.inst.id)}`"
              color="warning"
              size="sm"
              title="Open questions"
            />
            <UBadge
              v-if="
                item.inst.id !== activeId &&
                unread(item.inst.id, item.inst.lines.length)
              "
              :label="String(unread(item.inst.id, item.inst.lines.length))"
              size="sm"
            />
            <UIcon
              v-if="!item.inst.online && !openQuestions(item.inst.id)"
              name="i-lucide-x"
              class="size-3.5 text-dimmed hover:text-default"
              title="Dismiss"
              @click.stop="dismiss(item.inst.id)"
            />
          </template>
        </UTabs>
        <UButton
          v-if="
            notifications.supported.value &&
            notifications.permission.value === 'default'
          "
          icon="i-lucide-bell"
          label="Enable notifications"
          color="neutral"
          variant="subtle"
          size="xs"
          @click="notifications.enable"
        />
        <UBadge
          :label="connected ? 'live' : 'reconnecting…'"
          :color="connected ? 'success' : 'error'"
          variant="subtle"
          size="sm"
        />
      </header>
      <main v-if="active" class="flex min-h-0 flex-1 flex-col">
        <div
          class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-default px-3 py-1.5 text-xs text-muted"
        >
          <span>{{ active.repo }}</span>
          <span>{{ active.host }} · pid {{ active.pid }}</span>
          <UBadge
            :color="
              active.online
                ? active.paused
                  ? 'warning'
                  : 'success'
                : 'neutral'
            "
            variant="subtle"
            size="sm"
            :label="
              active.online
                ? active.paused
                  ? `paused — ${active.status}`
                  : active.status
                : `offline — ${active.status}`
            "
          />
        </div>
        <div class="flex min-h-0 flex-1">
          <LogView :key="active.id" :lines="active.lines" />
          <aside
            class="grid w-96 shrink-0 content-start gap-3 overflow-y-auto border-l border-default p-3"
          >
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
      <main v-else class="grid flex-1 place-content-center text-muted">
        <p>
          No loops connected. Start one with
          <UKbd value="claudjar loop <milestone>" /> and
          <UKbd value="CLAUDJAR_MONITOR_URL" /> set.
        </p>
      </main>
    </div>
  </UApp>
</template>
