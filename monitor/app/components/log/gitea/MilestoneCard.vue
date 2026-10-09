<script setup lang="ts">
import type { GiteaMilestone } from "~/utils/gitea";
import ForgeLink from "../ForgeLink.vue";
import Description from "./Description.vue";
import StateBadge from "./StateBadge.vue";

/** One milestone: title (linked), state, description and its issue progress. */
const props = defineProps<{
  milestone: GiteaMilestone;
  href?: string | undefined;
}>();

const total = computed(
  () => props.milestone.open_issues + props.milestone.closed_issues,
);
const due = computed(() =>
  props.milestone.due_on
    ? new Date(props.milestone.due_on).toLocaleDateString("en-GB")
    : "",
);
</script>

<template>
  <div class="grid gap-1">
    <div class="flex flex-wrap items-center gap-2">
      <ForgeLink
        :text="milestone.title"
        :href="href"
        class="font-sans text-sm font-medium text-highlighted"
      />
      <StateBadge :state="milestone.state" />
      <span v-if="due" class="text-dimmed">due {{ due }}</span>
    </div>
    <Description :text="milestone.description" />
    <div class="flex items-center gap-2">
      <UProgress
        :model-value="milestone.closed_issues"
        :max="Math.max(total, 1)"
        size="xs"
        class="max-w-48"
      />
      <span class="text-muted"
        >Finished {{ milestone.closed_issues }} / {{ total }} issues</span
      >
    </div>
  </div>
</template>
