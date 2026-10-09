<script setup lang="ts">
import type { LogLine } from "#shared/protocol";
import { clock } from "~/utils/instances";
import { parseJson } from "~/utils/json";
import {
  basename,
  inputMarkdown,
  jsonResultMarkdown,
  patchText,
  splitTool,
  toolIcon,
  type LogItem,
} from "~/utils/log";
import { fence, markdownPlugins } from "~/utils/markdown";

const props = defineProps<{ item: LogItem }>();

const line = computed(() => props.item.line);
const result = computed(() => props.item.result);
const tool = computed(() => splitTool(line.value.text));

/** The call's input, highlighted: a Bash command, or any other tool's JSON. */
const input = computed(() => {
  const d = line.value.detail;
  if (d?.type === "command") return fence("bash", d.command);
  if (d?.type === "input") return inputMarkdown(d.json);
  return "";
});
/** An Edit/Write diff, from the result Claude Code reported for the call. */
const diff = computed(() => {
  const d = result.value?.detail;
  return d?.type === "patch"
    ? fence("diff", patchText(d), `[${basename(d.file)}]`)
    : "";
});
const failed = computed(() => result.value?.kind === "error");
/**
 * Still running: no result yet. A call without an id (from a loop that predates
 * pairing) can never receive one, so it never spins.
 */
const running = computed(() => Boolean(line.value.call) && !result.value);

/** A standalone output line (no paired call), or the paired call's result. */
const json = (l: LogLine | undefined) => (l ? parseJson(l.text) : undefined);
</script>

<template>
  <div
    class="grid grid-cols-[4rem_2.75rem_1fr] px-3 py-px font-mono text-[12.5px]/normal hover:bg-elevated/40"
  >
    <span class="select-none text-dimmed">{{ clock(line.t) }}</span>
    <span class="select-none text-dimmed">{{
      line.issue ? `#${line.issue}` : ""
    }}</span>

    <div class="min-w-0">
      <!-- A tool call, its result folded in: hidden until opened, except diffs. -->
      <UChatTool
        v-if="line.kind === 'tool'"
        :text="tool.name"
        :suffix="tool.summary"
        :icon="failed ? 'i-lucide-circle-x' : toolIcon(tool.name)"
        :default-open="Boolean(diff)"
        :loading="running"
        chevron="leading"
        unmount-on-hide
        :ui="{
          root: 'w-full',
          trigger: failed ? 'text-error' : 'text-info',
          suffix: 'truncate',
        }"
      >
        <div class="grid gap-2 py-1">
          <Markdown v-if="input" :value="input" :plugins="markdownPlugins" />
          <Markdown v-if="diff" :value="diff" :plugins="markdownPlugins" />
          <template v-else-if="result">
            <Markdown
              v-if="jsonResultMarkdown(result.text)"
              :value="jsonResultMarkdown(result.text) ?? ''"
              :plugins="markdownPlugins"
            />
            <JsonNode
              v-else-if="json(result) !== undefined"
              :value="json(result) ?? null"
            />
            <pre
              v-else
              :class="[
                'whitespace-pre-wrap break-all',
                failed ? 'text-error' : 'text-muted',
              ]"
              >{{ result.text }}</pre>
          </template>
          <span v-else-if="running" class="text-dimmed">Running…</span>
        </div>
      </UChatTool>

      <UChatReasoning
        v-else-if="line.kind === 'thinking'"
        :text="line.text"
        :default-open="false"
        unmount-on-hide
        :ui="{ trigger: 'text-secondary' }"
      >
        <Markdown
          :value="line.text"
          :plugins="markdownPlugins"
          class="font-sans text-sm text-muted"
        />
      </UChatReasoning>

      <Markdown
        v-else-if="line.kind === 'text' || line.kind === 'result'"
        :value="line.text"
        :plugins="markdownPlugins"
        :class="[
          'font-sans text-sm',
          line.kind === 'result' ? 'text-success' : 'text-default',
        ]"
      />

      <!-- A result whose call is unknown (lines from before calls were paired). -->
      <UCollapsible
        v-else-if="line.kind === 'output' || line.kind === 'error'"
        unmount-on-hide
      >
        <UButton
          variant="link"
          size="xs"
          :color="line.kind === 'error' ? 'error' : 'neutral'"
          trailing-icon="i-lucide-chevron-down"
          class="px-0 font-mono"
          :label="line.kind === 'error' ? 'error output' : 'output'"
        />
        <template #content>
          <Markdown
            v-if="jsonResultMarkdown(line.text)"
            :value="jsonResultMarkdown(line.text) ?? ''"
            :plugins="markdownPlugins"
          />
          <JsonNode
            v-else-if="json(line) !== undefined"
            :value="json(line) ?? null"
          />
          <pre v-else class="whitespace-pre-wrap break-all text-muted">{{
            line.text
          }}</pre>
        </template>
      </UCollapsible>

      <span
        v-else
        :class="[
          'whitespace-pre-wrap break-words',
          {
            'font-semibold text-primary': line.kind === 'loop',
            'text-warning': line.kind === 'input',
            'text-info': line.kind === 'system',
          },
        ]"
        >{{ line.text }}</span
      >
    </div>
  </div>
</template>
