<script setup lang="ts">
import ForgeLink from "../ForgeLink.vue";

/** The inline "<what> on repo <name>" of a gitea call, `what` linked. */
defineProps<{
  what?: string;
  href?: string | undefined;
  repo: string;
  repoName: string;
}>();
</script>

<template>
  <span>
    <ForgeLink
      v-if="what"
      :text="what"
      :href="href"
      class="text-default"
    /><template v-if="what && repoName"> on repo </template
    ><span v-if="repoName" :title="repo">{{ repoName }}</span>
  </span>
</template>
