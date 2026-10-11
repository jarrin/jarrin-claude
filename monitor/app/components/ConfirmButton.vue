<script setup lang="ts">
/**
 * A button for a destructive action: clicking it opens a dialog that says
 * what will happen, and only its confirm button emits `confirm`.
 */
withDefaults(
  defineProps<{
    label: string;
    icon: string;
    title: string;
    description: string;
    /** The dialog's confirm button; defaults to `label`. */
    confirmLabel?: string;
    color?: "error" | "warning" | "primary" | "neutral";
    disabled?: boolean;
    loading?: boolean;
    /** Shown on hover: why the action is (not) available. */
    hint?: string;
  }>(),
  {
    confirmLabel: "",
    color: "error",
    disabled: false,
    loading: false,
    hint: "",
  },
);
const emit = defineEmits<{ confirm: [] }>();
const open = ref(false);
const confirm = (): void => {
  open.value = false;
  emit("confirm");
};
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <UButton
      :icon="icon"
      :label="label"
      :color="color"
      variant="subtle"
      size="xs"
      :disabled="disabled"
      :loading="loading"
      :title="hint || undefined"
    />
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="subtle"
          @click="open = false"
        />
        <UButton
          :icon="icon"
          :label="confirmLabel || label"
          :color="color"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
