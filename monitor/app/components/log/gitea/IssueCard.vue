<script setup lang="ts">
import type { GiteaIssue } from "~/utils/gitea";
import ForgeLink from "../ForgeLink.vue";
import Description from "./Description.vue";
import StateBadge from "./StateBadge.vue";

/** One issue: number + title (linked), state, labels, people, milestone, body. */
defineProps<{
  issue: GiteaIssue;
  href?: string | undefined;
  milestoneHref?: string | undefined;
}>();
</script>

<template>
  <div class="grid gap-1">
    <div class="flex flex-wrap items-center gap-2">
      <ForgeLink
        :text="`#${issue.number} ${issue.title}`"
        :href="href"
        class="font-sans text-sm font-medium text-highlighted"
      />
      <StateBadge :state="issue.state" />
      <UBadge
        v-if="issue.is_pull"
        label="pull request"
        color="neutral"
        variant="subtle"
        size="sm"
      />
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
      <span v-if="issue.user">by {{ issue.user }}</span>
      <span v-if="issue.assignees?.length"
        >assigned {{ issue.assignees.join(", ") }}</span
      >
      <span v-if="issue.milestone" class="flex items-center gap-1">
        <UIcon name="i-lucide-milestone" class="size-3.5" />
        <ForgeLink :text="issue.milestone.title" :href="milestoneHref" />
      </span>
      <span v-if="issue.comments">{{ issue.comments }} comments</span>
      <UBadge
        v-for="l in issue.labels ?? []"
        :key="l"
        :label="l"
        color="neutral"
        variant="outline"
        size="sm"
      />
    </div>
    <Description :text="issue.body" />
  </div>
</template>
