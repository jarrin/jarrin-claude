<script setup lang="ts">
import type { GiteaIssue, Listed } from "~/utils/gitea";
import ForgeLink from "../ForgeLink.vue";

/** Issues one per line: state icon, number + title (linked), labels. */
defineProps<{
  list: Listed<GiteaIssue>;
  href: (issue: GiteaIssue) => string | undefined;
}>();
</script>

<template>
  <div class="grid gap-0.5">
    <p v-if="list.items.length === 0" class="text-dimmed">No issues.</p>
    <div
      v-for="i in list.items"
      :key="`${i.repository ?? ''}#${i.number}`"
      class="flex min-w-0 items-center gap-1.5"
    >
      <UIcon
        :name="
          i.state === 'open' ? 'i-lucide-circle-dot' : 'i-lucide-circle-check'
        "
        :class="[
          'size-3.5 shrink-0',
          i.state === 'open' ? 'text-success' : 'text-secondary',
        ]"
      />
      <ForgeLink
        :text="`#${i.number}`"
        :href="href(i)"
        class="shrink-0 text-muted"
      />
      <ForgeLink :text="i.title" :href="href(i)" class="min-w-0 truncate" />
      <UBadge
        v-for="l in i.labels ?? []"
        :key="l"
        :label="l"
        color="neutral"
        variant="outline"
        size="sm"
        class="shrink-0"
      />
    </div>
    <p v-if="list.more" class="text-dimmed">… {{ list.more }} more</p>
  </div>
</template>
