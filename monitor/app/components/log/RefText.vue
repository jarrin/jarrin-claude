<script setup lang="ts">
import { issueUrl, milestoneUrl, refSegments } from "~/utils/forge";
import ForgeLink from "./ForgeLink.vue";

/** Text whose `#123` issue and milestone-title mentions link to the forge. */
const props = defineProps<{ text: string }>();

const forge = useForge();
const segments = computed(() =>
  refSegments(props.text, forge.value.milestones).map((s) => ({
    text: s.text,
    href:
      s.kind === "issue"
        ? issueUrl(forge.value, s.issue)
        : s.kind === "milestone"
          ? milestoneUrl(forge.value, s.milestone)
          : undefined,
  })),
);
</script>

<template>
  <template v-for="(s, i) in segments" :key="i">
    <ForgeLink
      v-if="s.href"
      :text="s.text"
      :href="s.href"
      class="underline decoration-dotted"
    />
    <template v-else>{{ s.text }}</template>
  </template>
</template>
