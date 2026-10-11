<script setup lang="ts">
import type { InstanceSummary, SessionStatus } from "#shared/protocol";
import { milestoneUrl } from "~/utils/forge";
import { clock } from "~/utils/instances";
import type { ProjectTab } from "~/utils/projects";
import { worktreeLabel, worktreeLoops } from "~/utils/projects";

/**
 * One open project: its backlog repo's open milestones and its worktrees, each
 * with the milestone it is linked to, its session and the loops working it.
 */
const props = defineProps<{
  tab: ProjectTab;
  instances: readonly InstanceSummary[];
}>();
defineEmits<{ refresh: []; close: []; "open-loop": [id: string] }>();

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
  <div class="grid content-start gap-4 overflow-y-auto p-3">
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
          class="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-3 text-sm"
        >
          <ULink
            v-if="milestoneUrl(forge, m.id)"
            :to="milestoneUrl(forge, m.id)"
            target="_blank"
            class="truncate font-mono"
          >
            {{ m.title }}
          </ULink>
          <span v-else class="truncate font-mono">{{ m.title }}</span>
          <UProgress
            :model-value="done(m.openIssues, m.closedIssues)"
            size="sm"
          />
          <span class="text-xs text-muted">
            {{ m.openIssues }} open · {{ m.closedIssues }} closed
          </span>
        </div>
      </UCard>

      <UCard :ui="{ body: 'grid gap-2' }">
        <template #header>
          <h2 class="font-semibold">Worktrees</h2>
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
            :color="l.online ? (l.paused ? 'warning' : 'success') : 'neutral'"
            variant="subtle"
            size="xs"
            @click="$emit('open-loop', l.id)"
          />
          <span class="basis-full truncate font-mono text-xs text-muted">{{
            w.path
          }}</span>
        </div>
      </UCard>
    </template>
  </div>
</template>
