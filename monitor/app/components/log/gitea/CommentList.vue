<script setup lang="ts">
import type { GiteaComment } from "~/utils/gitea";
import { markdownPlugins } from "~/utils/markdown";

/** Issue comments: author and date, then the rendered body. */
defineProps<{ comments: readonly GiteaComment[] }>();

const when = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString("en-GB") : "";
</script>

<template>
  <div class="grid gap-2">
    <p v-if="comments.length === 0" class="text-dimmed">No comments.</p>
    <div v-for="c in comments" :key="c.id" class="grid gap-0.5">
      <div class="text-muted">
        <span class="text-default">{{ c.user || "someone" }}</span>
        {{ when(c.created_at) }}
      </div>
      <Markdown
        :value="c.body"
        :plugins="markdownPlugins"
        class="border-l-2 border-default pl-2 font-sans text-sm"
      />
    </div>
  </div>
</template>
