<script setup lang="ts">
/** A link to the forge when its URL is known, plain text otherwise. */
defineProps<{ text: string; href?: string | undefined }>();
</script>

<template>
  <a
    v-if="href"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="hover:underline"
    @click.stop
    >{{ text }}</a
  >
  <span v-else>{{ text }}</span>
</template>
