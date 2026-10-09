<script setup lang="ts">
import { issueUrl } from "~/utils/forge";
import { clock } from "~/utils/instances";
import type { LogItem } from "~/utils/log";
import ForgeLink from "./ForgeLink.vue";
import ToolOutput from "./ToolOutput.vue";

/**
 * The base every log entry renders through:
 *
 *   <time> <#issue> <icon> <action> <title> <inline-result>
 *   <collapsible content>
 *
 * The base owns the layout, the issue link, the running / failed state and the
 * open state; a child component (one per tool or line kind) supplies the icon,
 * the action, the title and its colour, and fills the two slots. A failed call
 * whose child shows no body still opens, onto its error.
 */
const props = withDefaults(
  defineProps<{
    item: LogItem;
    icon: string;
    /** Extra classes on the icon (its colour). */
    iconClass?: string;
    action?: string;
    title?: string;
    /** The title's colour. */
    titleClass?: string;
    /** Makes the title a link (to the forge). */
    titleHref?: string | undefined;
    /** Whether the entry has a body to open. */
    collapsible?: boolean;
    defaultOpen?: boolean;
    /** Let the inline result wrap instead of truncating (prose lines). */
    wrap?: boolean;
  }>(),
  {
    iconClass: "text-muted",
    action: "",
    title: "",
    titleClass: "text-highlighted",
    titleHref: undefined,
    collapsible: false,
    defaultOpen: false,
    wrap: false,
  },
);

defineSlots<{
  "inline-result"?: () => unknown;
  /** Always shown under the header, outside the collapsible (live output). */
  live?: () => unknown;
  default?: () => unknown;
}>();

const forge = useForge();
const line = computed(() => props.item.line);
const result = computed(() => props.item.result);

const failed = computed(
  () => result.value?.kind === "error" || line.value.kind === "error",
);
/**
 * Still running: no result yet. A call without an id (from a loop that predates
 * pairing) can never receive one, so it never spins.
 */
const running = computed(
  () => line.value.kind === "tool" && Boolean(line.value.call) && !result.value,
);
/** A failure always shows its error, even for an entry with no body. */
const showError = computed(
  () => !props.collapsible && failed.value && Boolean(result.value),
);
const expandable = computed(() => props.collapsible || showError.value);

const open = ref(props.defaultOpen);
const toggle = (): void => {
  if (expandable.value) open.value = !open.value;
};

const shownIcon = computed(() => {
  if (failed.value) return "i-lucide-circle-x";
  if (running.value) return "i-lucide-loader-circle";
  return props.icon;
});
const shownIconClass = computed(() => {
  if (failed.value) return "text-error";
  if (running.value) return "animate-spin text-info";
  return props.iconClass;
});
const issueHref = computed(() =>
  line.value.issue ? issueUrl(forge.value, line.value.issue) : undefined,
);
</script>

<template>
  <div
    class="grid grid-cols-[4rem_2.75rem_1fr] px-3 py-px font-mono text-[12.5px]/normal hover:bg-elevated/40"
  >
    <span class="select-none text-dimmed">{{ clock(line.t) }}</span>
    <span class="text-dimmed">
      <ForgeLink v-if="line.issue" :text="`#${line.issue}`" :href="issueHref" />
    </span>

    <div class="min-w-0">
      <div
        :class="[
          'flex min-w-0 gap-1.5',
          wrap ? 'items-start' : 'items-center',
          expandable && 'cursor-pointer',
        ]"
        :role="expandable ? 'button' : undefined"
        :tabindex="expandable ? 0 : undefined"
        :aria-expanded="expandable ? open : undefined"
        @click="toggle"
        @keydown.enter.space.self.prevent="toggle"
      >
        <UIcon
          :name="shownIcon"
          :class="['size-3.5 shrink-0', wrap && 'mt-0.75', shownIconClass]"
        />
        <span v-if="action" class="shrink-0 text-muted">{{ action }}</span>
        <ForgeLink
          v-if="title"
          :text="title"
          :href="titleHref"
          :class="['max-w-[60%] shrink-0 truncate', titleClass]"
        />
        <div
          v-if="$slots['inline-result']"
          :class="[
            'min-w-0 flex-1',
            wrap ? 'break-words' : 'truncate text-dimmed',
          ]"
        >
          <slot name="inline-result" />
        </div>
        <UIcon
          v-if="expandable"
          name="i-lucide-chevron-down"
          :class="[
            'size-3.5 shrink-0 text-dimmed transition-transform',
            open && 'rotate-180',
          ]"
        />
      </div>

      <slot name="live" />

      <UCollapsible v-if="expandable" v-model:open="open" unmount-on-hide>
        <template #content>
          <div class="grid gap-2 py-1 pl-5">
            <slot />
            <ToolOutput v-if="showError && result" :line="result" />
            <span v-if="running" class="text-dimmed">Running…</span>
          </div>
        </template>
      </UCollapsible>
    </div>
  </div>
</template>
