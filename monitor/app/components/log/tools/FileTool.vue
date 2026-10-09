<script setup lang="ts">
import { basename, patchText, toolIcon, type LogItem } from "~/utils/log";
import { fence, markdownPlugins } from "~/utils/markdown";
import { num, str, toolCall } from "~/utils/tools";
import LogRow from "../LogRow.vue";
import ToolOutput from "../ToolOutput.vue";

/** Read / Edit / Write / NotebookEdit: the file as title, its diff or content as body. */
const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));

/** Edit/Write send no input (their diff shows it), so the summary carries the path. */
const path = computed(
  () =>
    str(call.value.input, "file_path") ||
    str(call.value.input, "notebook_path") ||
    call.value.summary,
);
const dir = computed(() => path.value.slice(0, -basename(path.value).length));
const range = computed(() => {
  const offset = num(call.value.input, "offset");
  const limit = num(call.value.input, "limit");
  if (offset === undefined && limit === undefined) return "";
  const from = offset ?? 1;
  return limit === undefined
    ? `from line ${String(from)}`
    : `lines ${String(from)}–${String(from + limit - 1)}`;
});
const diff = computed(() => {
  const d = props.item.result?.detail;
  return d?.type === "patch"
    ? fence("diff", patchText(d), `[${basename(d.file)}]`)
    : "";
});
</script>

<template>
  <LogRow
    :item="item"
    :icon="toolIcon(call.name)"
    icon-class="text-info"
    :action="call.name"
    :title="basename(path)"
    :collapsible="Boolean(item.result)"
    :default-open="Boolean(diff)"
  >
    <template #inline-result
      >{{ dir }}<template v-if="range"> · {{ range }}</template></template
    >
    <Markdown v-if="diff" :value="diff" :plugins="markdownPlugins" />
    <ToolOutput v-else-if="item.result" :line="item.result" />
  </LogRow>
</template>
