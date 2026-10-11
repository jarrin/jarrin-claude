<script setup lang="ts">
import { worktreeNameFor } from "#shared/protocol";
import type {
  CommandOutcome,
  HostCommand,
  InstanceSummary,
  MilestoneDetail,
  SessionStatus,
} from "#shared/protocol";
import { milestoneUrl } from "~/utils/forge";
import { clock } from "~/utils/instances";
import type { ProjectTab } from "~/utils/projects";
import {
  createWorktreeCommand,
  loopRunning,
  milestoneLoops,
  outcomeOf,
  worktreeLabel,
  worktreeLoops,
} from "~/utils/projects";

/**
 * One open project: its backlog repo's open milestones and its worktrees, each
 * with the milestone it is linked to, its session and the loops working it.
 * From here a worktree is created: from a milestone with a loop working it, or
 * plain (optionally linked to a milestone) with a background Claude session —
 * and, once it exists, its loop aborted or restarted, and it merged back or
 * removed ({@link WorktreeActions}).
 */
const props = defineProps<{
  tab: ProjectTab;
  instances: readonly InstanceSummary[];
  outcomes: readonly CommandOutcome[];
  /** Send a command to this tab's host; the id its result comes back under, or null. */
  run: (command: HostCommand) => string | null;
  /** How many unanswered questions a loop has, by instance id. */
  openQuestions: (id: string) => number;
}>();
const emit = defineEmits<{
  refresh: [];
  close: [];
  "open-loop": [id: string];
  /** Abort a connected loop through the monitor (one the service did not start). */
  "stop-loop": [id: string];
}>();

/** The create-worktree in flight, if any: one at a time per tab. */
const pending = ref<string | null>(null);
const failure = ref("");
const busy = computed(() => pending.value !== null);
watch(
  () => (pending.value ? outcomeOf(props.outcomes, pending.value) : null),
  (outcome) => {
    if (!outcome) return;
    pending.value = null;
    failure.value = outcome.ok ? "" : outcome.error;
    if (outcome.ok) newName.value = "";
  },
);
const send = (command: HostCommand): void => {
  failure.value = "";
  pending.value = props.run(command);
  if (!pending.value) failure.value = "not connected to the monitor";
};

const loopOn = (m: MilestoneDetail): void => {
  send(createWorktreeCommand(props.tab.project.name, "loop", "", m));
};
const loopsOn = (m: MilestoneDetail): InstanceSummary[] =>
  detail.value ? milestoneLoops(props.instances, detail.value, m.id) : [];
const openLoopOn = (m: MilestoneDetail): void => {
  const [first] = loopsOn(m);
  if (first) emit("open-loop", first.id);
};

/** The plain "new worktree" form; milestone 0 is "none". */
const newName = ref("");
const newMilestone = ref(0);
const milestoneItems = computed(() => [
  { label: "no milestone", value: 0 },
  ...(detail.value?.milestones ?? []).map((m) => ({
    label: m.title,
    value: m.id,
  })),
]);
const chosen = computed(
  () =>
    detail.value?.milestones.find((m) => m.id === newMilestone.value) ?? null,
);
const namePlaceholder = computed(() =>
  chosen.value ? worktreeNameFor(chosen.value.title) : "name",
);
const canCreate = computed(
  () => !busy.value && (newName.value.trim() !== "" || chosen.value !== null),
);
const createPlain = (): void => {
  if (!canCreate.value) return;
  send(
    createWorktreeCommand(
      props.tab.project.name,
      "session",
      newName.value,
      chosen.value,
    ),
  );
};

const detail = computed(() => props.tab.detail);
const forge = computed(() => ({
  ...(detail.value?.forge ? { url: detail.value.forge } : {}),
  repo: detail.value?.repo ?? "",
  milestones: [],
}));

const sessionColor = (s: SessionStatus): "success" | "warning" | "neutral" =>
  s === "running" ? "success" : s === "stopped" ? "warning" : "neutral";

const done = (open: number, closed: number): number =>
  open + closed === 0 ? 0 : Math.round((closed / (open + closed)) * 100);
</script>

<template>
  <!-- A flex column, not a grid: grid rows shrink to the box and the cards
       (overflow-hidden) clip their rows instead of the view scrolling. -->
  <div
    class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 *:shrink-0"
  >
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span class="font-mono text-sm text-default">{{ tab.project.name }}</span>
      <span>{{ tab.host }}{{ tab.online ? "" : " · offline" }}</span>
      <span class="font-mono">{{ tab.project.path }}</span>
      <span v-if="detail">collected {{ clock(detail.collectedAt) }}</span>
      <span class="flex-1" />
      <UButton
        icon="i-lucide-refresh-cw"
        label="refresh"
        size="xs"
        color="neutral"
        variant="subtle"
        :disabled="!tab.online"
        @click="$emit('refresh')"
      />
      <UButton
        icon="i-lucide-x"
        label="close project"
        size="xs"
        color="neutral"
        variant="subtle"
        :disabled="!tab.online"
        @click="$emit('close')"
      />
    </div>

    <p v-if="!detail" class="text-muted">Collecting the project's detail…</p>
    <template v-else>
      <UAlert
        v-if="busy"
        color="info"
        variant="subtle"
        icon="i-lucide-loader"
        description="Creating the worktree (setup and hooks can take a few minutes)…"
      />
      <UAlert
        v-if="failure"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-x"
        title="Could not create the worktree"
        :description="failure"
        :close="true"
        @update:open="failure = ''"
      />
      <UCard :ui="{ body: 'grid gap-2' }">
        <template #header>
          <h2 class="font-semibold">
            Open milestones
            <span class="text-xs font-normal text-muted">{{
              detail.repo || "no backlog repo"
            }}</span>
          </h2>
        </template>
        <UAlert
          v-if="detail.error"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="detail.error"
        />
        <p v-else-if="!detail.milestones.length" class="text-sm text-muted">
          No open milestones.
        </p>
        <div
          v-for="m in detail.milestones"
          :key="m.id"
          class="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto]"
        >
          <ULink
            v-if="milestoneUrl(forge, m.id)"
            :to="milestoneUrl(forge, m.id)"
            target="_blank"
            class="col-span-full truncate font-mono sm:col-span-1"
          >
            {{ m.title }}
          </ULink>
          <span v-else class="col-span-full truncate font-mono sm:col-span-1">{{
            m.title
          }}</span>
          <UProgress
            :model-value="done(m.openIssues, m.closedIssues)"
            size="sm"
          />
          <span class="text-xs text-muted">
            {{ m.openIssues }} open · {{ m.closedIssues }} closed
          </span>
          <UButton
            v-if="loopsOn(m).length"
            icon="i-lucide-repeat"
            label="loop running"
            size="xs"
            color="success"
            variant="subtle"
            @click="openLoopOn(m)"
          />
          <UButton
            v-else
            icon="i-lucide-git-branch-plus"
            label="new worktree + loop"
            size="xs"
            color="primary"
            variant="subtle"
            :disabled="!tab.online || busy || !detail.repo"
            :loading="busy"
            @click="loopOn(m)"
          />
        </div>
      </UCard>

      <UCard :ui="{ body: 'grid gap-2' }">
        <template #header>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="mr-auto font-semibold">Worktrees</h2>
            <UInput
              v-model="newName"
              :placeholder="namePlaceholder"
              size="xs"
              class="w-48 font-mono"
              :disabled="busy"
              @keydown.enter="createPlain"
            />
            <USelect
              v-model="newMilestone"
              :items="milestoneItems"
              size="xs"
              class="w-48"
              :disabled="busy"
            />
            <UButton
              icon="i-lucide-git-branch-plus"
              label="new worktree"
              size="xs"
              color="primary"
              variant="subtle"
              :disabled="!tab.online || !canCreate"
              :loading="busy"
              @click="createPlain"
            />
          </div>
        </template>
        <div
          v-for="w in detail.worktrees"
          :key="w.path"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
        >
          <span class="font-mono font-semibold">{{ worktreeLabel(w) }}</span>
          <span
            v-if="w.branch && w.branch !== w.name"
            class="text-xs text-muted"
          >
            {{ w.branch }}
          </span>
          <UBadge
            v-if="w.port"
            :label="`:${w.port}`"
            color="neutral"
            variant="outline"
            size="sm"
          />
          <UBadge
            :label="
              w.session === 'none' ? 'no session' : `session ${w.session}`
            "
            :color="sessionColor(w.session)"
            variant="subtle"
            size="sm"
          />
          <UBadge
            v-if="w.milestone"
            icon="i-lucide-flag"
            :label="w.milestone"
            color="primary"
            variant="subtle"
            size="sm"
          />
          <UButton
            v-for="l in worktreeLoops(instances, detail, w)"
            :key="l.id"
            icon="i-lucide-repeat"
            :label="`loop: ${l.online ? l.status : 'offline'}`"
            :color="
              loopRunning(l) ? (l.paused ? 'warning' : 'success') : 'neutral'
            "
            variant="subtle"
            size="xs"
            @click="$emit('open-loop', l.id)"
          >
            <template v-if="openQuestions(l.id)" #trailing>
              <UBadge
                :label="`? ${openQuestions(l.id)}`"
                color="warning"
                size="sm"
                title="Open questions: answer them in the loop's tab"
              />
            </template>
          </UButton>
          <span class="basis-full truncate font-mono text-xs text-muted">{{
            w.path
          }}</span>
          <WorktreeActions
            v-if="w.name"
            class="basis-full"
            :project="tab.project.name"
            :worktree="w"
            :loops="worktreeLoops(instances, detail, w)"
            :online="tab.online"
            :outcomes="outcomes"
            :run="run"
            @stop-loop="(id) => $emit('stop-loop', id)"
          />
        </div>
      </UCard>
    </template>
  </div>
</template>
