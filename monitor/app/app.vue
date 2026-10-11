<script setup lang="ts">
import { instanceLabel } from "#shared/protocol";
import { boardsOf, questionsOf } from "~/utils/instances";
import type { Notice } from "~/utils/instances";
import { isProjectTab, projectTabs } from "~/utils/projects";
import type { ProjectTab } from "~/utils/projects";

/** The tab values of the fixed views; never a loop instance id. */
const LIVE_TAB = "live-logs";
const PROJECTS_TAB = "projects";
const FIXED_TABS: readonly (string | null)[] = [LIVE_TAB, PROJECTS_TAB];

const activeId = ref<string | null>(null);

const openNotice = (notice: Notice): void => {
  if (notice.instanceId) activeId.value = notice.instanceId;
};
const notifications = useNotifications(openNotice);
const {
  state,
  connected,
  dismiss,
  dismissLive,
  answer,
  control,
  input,
  command,
} = useMonitor(notifications.notify);

const instances = computed(() => state.value.instances);
const projects = computed(() => projectTabs(state.value));
const activeProject = computed(
  () => projects.value.find((p) => p.value === activeId.value) ?? null,
);
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
provideForge(
  computed(() => ({
    ...(active.value?.forge ? { url: active.value.forge } : {}),
    repo: active.value?.repo ?? "",
    milestones: active.value?.milestones ?? [],
  })),
);

// Open the first tab by default, and fall back when the active one is dismissed
// (a loop) or closed (a project).
watch(
  [instances, projects],
  ([list, open]) => {
    if (isProjectTab(activeId.value)) {
      if (!open.some((p) => p.value === activeId.value))
        activeId.value = PROJECTS_TAB;
    } else if (
      !FIXED_TABS.includes(activeId.value) &&
      !list.some((i) => i.id === activeId.value)
    )
      activeId.value = list[0]?.id ?? LIVE_TAB;
    const a = active.value;
    if (a) seen.value[a.id] = a.lines.length;
  },
  { immediate: true },
);

// A project tab's content is collected on demand: every time it is shown.
const refresh = (tab: ProjectTab): void => {
  if (tab.online)
    command(tab.host, { type: "refresh-project", project: tab.project.name });
};
watch(
  () => activeProject.value?.value,
  () => {
    if (activeProject.value) refresh(activeProject.value);
  },
);

const runningLive = computed(
  () => state.value.live.filter((l) => !l.done).length,
);
const tabs = computed(() => [
  { label: "live logs", value: LIVE_TAB, inst: undefined, proj: undefined },
  { label: "projects", value: PROJECTS_TAB, inst: undefined, proj: undefined },
  ...projects.value.map((proj) => ({
    label: `${proj.project.name} @ ${proj.host}`,
    value: proj.value,
    inst: undefined,
    proj,
  })),
  ...instances.value.map((inst) => ({
    label: instanceLabel(inst),
    value: inst.id,
    inst,
    proj: undefined,
  })),
]);
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
/** Capped, so a busy tab's badge keeps the width it was laid out with. */
const unreadLabel = (id: string, total: number): string => {
  const n = unread(id, total);
  return n > 999 ? "999+" : String(n);
};
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
          class="min-w-0 flex-1 self-stretch"
          :ui="{
            root: 'h-full items-stretch',
            list: 'h-full overflow-x-auto overflow-y-hidden border-b-0 border-l border-default p-0 mb-0',
            trigger:
              'rounded-none border-r border-default px-3 data-[state=active]:bg-black/5 dark:data-[state=active]:bg-black/25',
          }"
        >
          <template #leading="{ item }">
            <UIcon
              v-if="item.proj"
              name="i-lucide-folder-open"
              :class="['size-3.5', !item.proj.online && 'text-dimmed']"
            />
            <UIcon
              v-else-if="!item.inst"
              :name="
                item.value === PROJECTS_TAB
                  ? 'i-lucide-folder-git-2'
                  : 'i-lucide-scroll-text'
              "
              class="size-3.5"
            />
            <span
              v-else
              :class="['size-2 rounded-full', dotClass(item.inst)]"
            />
          </template>
          <template #trailing="{ item }">
            <UBadge
              v-if="item.value === LIVE_TAB"
              :label="String(runningLive)"
              color="info"
              size="sm"
              :class="['min-w-6 justify-center', !runningLive && 'invisible']"
              title="Running"
            />
            <template v-else-if="item.inst">
              <UBadge
                v-if="openQuestions(item.inst.id)"
                :label="`? ${openQuestions(item.inst.id)}`"
                color="warning"
                size="sm"
                title="Open questions"
              />
              <!-- Always laid out, so it appearing never shifts the tabs beside it. -->
              <UBadge
                :label="unreadLabel(item.inst.id, item.inst.lines.length)"
                size="sm"
                :class="[
                  'min-w-9 justify-center',
                  (item.inst.id === activeId ||
                    !unread(item.inst.id, item.inst.lines.length)) &&
                    'invisible',
                ]"
              />
              <UIcon
                v-if="!item.inst.online && !openQuestions(item.inst.id)"
                name="i-lucide-x"
                class="size-3.5 text-dimmed hover:text-default"
                title="Dismiss"
                @click.stop="dismiss(item.inst.id)"
              />
            </template>
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
        <UButton
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          size="xs"
          title="Log out"
          to="/auth/logout"
          external
        />
      </header>
      <main v-if="activeId === LIVE_TAB" class="flex min-h-0 flex-1 flex-col">
        <LiveLogs
          :logs="state.live"
          @dismiss="(ids) => ids.forEach((id) => dismissLive(id))"
        />
      </main>
      <main
        v-else-if="activeId === PROJECTS_TAB"
        class="flex min-h-0 flex-1 flex-col"
      >
        <HostList
          :hosts="state.hosts"
          :outcomes="state.outcomes"
          @command="(host, cmd) => command(host, cmd)"
        />
      </main>
      <main v-else-if="activeProject" class="flex min-h-0 flex-1 flex-col">
        <ProjectView
          :key="activeProject.value"
          :tab="activeProject"
          :instances="instances"
          @refresh="activeProject && refresh(activeProject)"
          @close="
            activeProject &&
            command(activeProject.host, {
              type: 'close-project',
              project: activeProject.project.name,
            })
          "
          @open-loop="(id) => (activeId = id)"
        />
      </main>
      <main v-else-if="active" class="flex min-h-0 flex-1 flex-col">
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
