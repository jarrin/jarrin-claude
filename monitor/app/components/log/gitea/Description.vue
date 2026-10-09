<script setup lang="ts">
import { markdownPlugins } from "~/utils/markdown";

/** A description / body behind a "Read …" button; nothing when it is empty. */
withDefaults(defineProps<{ text?: string | null; label?: string }>(), {
  text: "",
  label: "Read description",
});
</script>

<template>
  <UCollapsible v-if="text?.trim()" unmount-on-hide>
    <UButton
      :label="label"
      variant="link"
      color="neutral"
      size="xs"
      trailing-icon="i-lucide-chevron-down"
      class="px-0 font-mono"
    />
    <template #content>
      <Markdown
        :value="text"
        :plugins="markdownPlugins"
        class="border-l-2 border-default pl-2 font-sans text-sm"
      />
    </template>
  </UCollapsible>
</template>
