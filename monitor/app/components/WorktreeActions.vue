<script setup lang="ts">
import type {
  CommandOutcome,
  HostCommand,
  InstanceSummary,
  WorktreeDetail,
} from "#shared/protocol";
import {
  loopRunning,
  outcomeOf,
  worktreeActionState,
  worktreeCommand,
} from "~/utils/projects";

/**
 * What can be done to a worktree once it exists, enabled by its state: abort
 * or restart its loop, merge it back into the checkout it was cut from, and
 * remove it (stack teardown and remove hooks included). The destructive ones
 * ask first. Shown on the project tab's worktree row and on a loop's tab.
 */
const props = defineProps<{
  project: string;
  worktree: WorktreeDetail;
  /** The loop instances working this worktree. */
  loops: readonly InstanceSummary[];
  online: boolean;
  outcomes: readonly CommandOutcome[];
  /** Send a command to the worktree's host; the id its result comes back under, or null. */
  run: (command: HostCommand) => string | null;
}>();
const emit = defineEmits<{
  /** Abort a connected loop the service did not start, through the monitor. */
  "stop-loop": [id: string];
}>();

const state = computed(() =>
  worktreeActionState(props.worktree, props.loops, props.online),
);

/** The command in flight, if any: one at a time. */
const pending = ref<{ id: string; what: string } | null>(null);
const failure = ref("");
watch(
  () => (pending.value ? outcomeOf(props.outcomes, pending.value.id) : null),
  (outcome) => {
    if (!outcome || !pending.value) return;
    failure.value = outcome.ok
      ? ""
      : `${pending.value.what} failed: ${outcome.error}`;
    pending.value = null;
  },
);
const busy = computed(() => pending.value !== null);

const send = (command: HostCommand, what: string): void => {
  failure.value = "";
  const id = props.run(command);
  if (id) pending.value = { id, what };
  else failure.value = "not connected to the monitor";
};
const name = computed(() => props.worktree.name);

const abort = (): void => {
  if (props.worktree.loopPid > 0) {
    send(worktreeCommand("stop-loop", props.project, name.value), "abort");
    return;
  }
  for (const l of props.loops.filter(loopRunning)) emit("stop-loop", l.id);
};
const restart = (): void =>
  send(worktreeCommand("resume-loop", props.project, name.value), "restart");
const merge = (remove: boolean): void =>
  send(
    worktreeCommand("merge-worktree", props.project, name.value, remove),
    remove ? "merge & remove" : "merge",
  );
const remove = (): void =>
  send(worktreeCommand("remove-worktree", props.project, name.value), "remove");
</script>

<template>
  <div v-if="worktree.name" class="flex flex-wrap items-center gap-2">
    <ConfirmButton
      v-if="state.running"
      icon="i-lucide-square"
      label="abort loop"
      color="warning"
      title="Abort the loop?"
      :description="`The running session in ${name} ends, its uncommitted work is stashed, and no new one starts. Restart the loop to pick it up again.`"
      :disabled="!state.canAbort || busy"
      @confirm="abort"
    />
    <UButton
      v-else-if="worktree.milestone"
      icon="i-lucide-rotate-ccw"
      label="restart loop"
      size="xs"
      color="primary"
      variant="subtle"
      :title="state.hint || `Run claudjar loop on ${worktree.milestone} again`"
      :disabled="!state.canRestart || busy"
      :loading="pending?.what === 'restart'"
      @click="restart"
    />
    <ConfirmButton
      icon="i-lucide-git-merge"
      label="merge"
      color="primary"
      title="Merge the worktree back?"
      :description="`Merges ${worktree.branch || name} into the checkout it was created from. A conflict is aborted and nothing changes. The worktree is kept.`"
      :hint="state.hint"
      :disabled="!state.canMerge || busy"
      :loading="pending?.what === 'merge'"
      @confirm="merge(false)"
    />
    <ConfirmButton
      icon="i-lucide-git-merge"
      label="merge & remove"
      title="Merge and remove the worktree?"
      :description="`Merges ${worktree.branch || name} back, then tears its stack down, runs the remove hooks and deletes the worktree and its branch. Nothing is removed if the merge fails.`"
      :hint="state.hint"
      :disabled="!state.canMerge || busy"
      :loading="pending?.what === 'merge & remove'"
      @confirm="merge(true)"
    />
    <ConfirmButton
      icon="i-lucide-trash-2"
      label="remove"
      title="Remove the worktree?"
      :description="`Stops the session and loop in ${name}, tears its stack down, runs the remove hooks and deletes the worktree. An unmerged branch is kept; uncommitted changes make it refuse.`"
      :disabled="!state.canRemove || busy"
      :loading="pending?.what === 'remove'"
      @confirm="remove"
    />
    <UAlert
      v-if="failure"
      class="basis-full"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-x"
      :description="failure"
      :close="true"
      @update:open="failure = ''"
    />
  </div>
</template>
