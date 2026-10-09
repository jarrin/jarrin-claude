<script setup lang="ts">
/** An issue / milestone state: open in green, closed in purple, like the forge. */
defineProps<{ state: string }>();
</script>

<template>
  <UBadge
    :label="state"
    :color="
      state === 'open'
        ? 'success'
        : state === 'closed'
          ? 'secondary'
          : 'neutral'
    "
    variant="subtle"
    size="sm"
  />
</template>
