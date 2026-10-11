<script setup lang="ts">
import { instanceLabel } from "#shared/protocol";
import { boardsOf, openQuestionsOf, questionsOf } from "~/utils/instances";
import type { Notice } from "~/utils/instances";
import {
  isProjectTab,
  loopParent,
  loopsUnder,
  projectOpenQuestions,
  projectTabs,
  worktreeLoops,
  worktreeOfInstance,
} from "~/utils/projects";
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
const unanswered = computed(() =>
  questions.value.some((q) => q.answer === null),
);
/** The worktree the active loop works in, when an open project shows it. */
const activeWorktree = computed(() => {
  const a = active.value;
  const found = a ? worktreeOfInstance(state.value.details, a) : null;
  if (!found) return null;
  const host = state.value.hosts.find((h) => h.host === found.detail.host);
  return {
    ...found,
    online: host?.online ?? false,
    loops: worktreeLoops(instances.value, found.detail, found.worktree),
  };
});
provideForge(
  computed(() => ({
    ...(active.value?.forge ? { url: active.value.forge } : {}),
    repo: active.value?.repo ?? "",
    milestones: active.value?.milestones ?? [],
  })),
);

// Open the first project by default, and fall back when the active tab is
// dismissed (a loop) or closed (a project).
watch(
  [instances, projects],
  ([list, open]) => {
    const home = open[0]?.value ?? PROJECTS_TAB;
    if (isProjectTab(activeId.value)) {
      if (!open.some((p) => p.value === activeId.value)) activeId.value = home;
    } else if (
      !FIXED_TABS.includes(activeId.value) &&
      !list.some((i) => i.id === activeId.value)
    )
      activeId.value = home;
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
/**
 * Two rows: the main bar holds the projects overview, one tab per open project
 * and — pushed right — the live logs; the bar under it holds the loops of the
 * main tab in view. A loop sits under the project whose worktree it works, or
 * under the overview when no open project claims it.
 */
const mainTabs = computed(() => [
  { label: "projects", value: PROJECTS_TAB, proj: undefined, ui: {} },
  ...projects.value.map((proj) => ({
    label: `${proj.project.name} @ ${proj.host}`,
    value: proj.value,
    proj,
    ui: {},
  })),
  {
    label: "live logs",
    value: LIVE_TAB,
    proj: undefined,
    // `ui.trigger`: an item's `class` styles its content, not its tab.
    ui: { trigger: "ms-auto border-l border-default" },
  },
]);
/** The main tab in view: the active loop's parent while a loop is shown. */
const mainSelected = computed({
  get: () =>
    active.value
      ? loopParent(state.value.details, active.value, PROJECTS_TAB)
      : (activeId.value ?? undefined),
  set: (id: string | number | undefined) => {
    activeId.value = id === undefined ? null : String(id);
  },
});
const loopTabs = computed(() => {
  const parent = mainSelected.value;
  if (!parent || parent === LIVE_TAB) return [];
  return loopsUnder(
    parent,
    instances.value,
    state.value.details,
    PROJECTS_TAB,
  ).map((inst) => ({ label: instanceLabel(inst), value: inst.id, inst }));
});
/** No loop tab is selected while the parent's own view is shown. */
const loopSelected = computed({
  get: () => active.value?.id ?? "",
  set: (id: string | number | undefined) => {
    if (id !== undefined) activeId.value = String(id);
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
  return inst ? openQuestionsOf(state.value, inst).length : 0;
};
/** A project tab counts the open questions of every loop on its worktrees. */
const projectQuestions = (tab: ProjectTab): number =>
  projectOpenQuestions(state.value, tab.detail).length;
</script>

<template>
  <UApp>
    <div class="flex h-dvh flex-col bg-default text-default">
      <header
        class="flex items-center gap-3 border-b border-default bg-elevated/50 px-3"
      >
        <span class="flex items-center gap-2 font-semibold text-primary">
          <img src="/icon.svg" alt="" class="size-5" />
          <span class="hidden sm:inline">claudjar</span>
        </span>
        <UTabs
          v-model="mainSelected"
          :items="mainTabs"
          :content="false"
          variant="link"
          size="sm"
          class="min-w-0 flex-1 self-stretch"
          :ui="{
            root: 'h-full items-stretch',
            list: 'h-full w-full overflow-x-auto overflow-y-hidden border-b-0 border-l border-default p-0 mb-0',
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
              v-else
              :name="
                item.value === PROJECTS_TAB
                  ? 'i-lucide-folder-git-2'
                  : 'i-lucide-scroll-text'
              "
              class="size-3.5"
            />
          </template>
          <template #trailing="{ item }">
            <UBadge
              v-if="item.proj && projectQuestions(item.proj)"
              :label="`? ${projectQuestions(item.proj)}`"
              color="warning"
              size="sm"
              title="Open questions in this project's loops"
            />
            <UBadge
              v-else-if="item.value === LIVE_TAB"
              :label="String(runningLive)"
              color="info"
              size="sm"
              :class="['min-w-6 justify-center', !runningLive && 'invisible']"
              title="Running"
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
      <nav
        v-if="loopTabs.length > 0"
        class="flex h-9 shrink-0 items-stretch border-b border-default bg-elevated/25 px-3"
      >
        <UTabs
          v-model="loopSelected"
          :items="loopTabs"
          :content="false"
          variant="link"
          size="xs"
          class="min-w-0 flex-1 self-stretch"
          :ui="{
            root: 'h-full items-stretch',
            list: 'h-full overflow-x-auto overflow-y-hidden border-b-0 border-l border-default p-0 mb-0',
            trigger:
              'rounded-none border-r border-default px-3 data-[state=active]:bg-black/5 dark:data-[state=active]:bg-black/25',
          }"
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
              v-if="!item.inst.online"
              name="i-lucide-x"
              class="size-3.5 text-dimmed hover:text-default"
              :title="
                openQuestions(item.inst.id)
                  ? 'Dismiss (drops its open questions)'
                  : 'Dismiss'
              "
              @click.stop="dismiss(item.inst.id)"
            />
          </template>
        </UTabs>
      </nav>
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
          :outcomes="state.outcomes"
          :open-questions="openQuestions"
          :run="
            (cmd) => (activeProject ? command(activeProject.host, cmd) : null)
          "
          @refresh="activeProject && refresh(activeProject)"
          @close="
            activeProject &&
            command(activeProject.host, {
              type: 'close-project',
              project: activeProject.project.name,
            })
          "
          @open-loop="(id) => (activeId = id)"
          @stop-loop="(id) => control(id, 'stop')"
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
          <template v-if="activeWorktree">
            <span class="flex-1" />
            <span class="font-mono">
              {{ activeWorktree.detail.project }}/{{
                activeWorktree.worktree.name
              }}
            </span>
            <WorktreeActions
              :project="activeWorktree.detail.project"
              :worktree="activeWorktree.worktree"
              :loops="activeWorktree.loops"
              :online="activeWorktree.online"
              :outcomes="state.outcomes"
              :run="
                (cmd) =>
                  activeWorktree
                    ? command(activeWorktree.detail.host, cmd)
                    : null
              "
              @stop-loop="(id) => control(id, 'stop')"
            />
          </template>
        </div>
        <div class="flex min-h-0 flex-1 flex-col md:flex-row">
          <LogView :key="active.id" :lines="active.lines" />
          <!-- A flex column, not a grid: grid rows shrink to the box and the
               cards (overflow-hidden) clip their tickets instead of scrolling.
               Stacked under the log on a phone, capped so the log keeps room. -->
          <aside
            class="flex max-h-[45%] shrink-0 flex-col gap-3 overflow-y-auto border-t border-default p-3 *:shrink-0 md:max-h-none md:w-96 md:border-t-0 md:border-l"
          >
            <!-- An unanswered question goes first, above a long ticket list. -->
            <QuestionList
              :class="unanswered ? 'order-first' : 'order-last'"
              :questions="questions"
              @answer="(id, text) => answer(id, text)"
            />
            <ProgressTree :boards="boards" />
          </aside>
        </div>
        <ActionBar
          :instance="active"
          @pause="control(active.id, 'pause')"
          @resume="control(active.id, 'resume')"
          @stop="control(active.id, 'stop')"
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
