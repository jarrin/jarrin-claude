<script setup lang="ts">
import type { LogItem } from "~/utils/log";
import {
  mcpName,
  prettyName,
  primaryArg,
  serverName,
  toolCall,
} from "~/utils/tools";
import LogRow from "../../LogRow.vue";
import ToolDetails from "../../ToolDetails.vue";

/** Fallback for an MCP tool: the server as action, the tool as title. */
const props = defineProps<{ item: LogItem }>();
const call = computed(() => toolCall(props.item.line));
const mcp = computed(() => mcpName(call.value.name));
</script>

<template>
  <LogRow
    :item="item"
    icon="i-lucide-plug"
    icon-class="text-info"
    :action="mcp ? serverName(mcp.server) : call.name"
    :title="mcp ? prettyName(mcp.tool) : ''"
    title-class="text-info"
    collapsible
  >
    <template v-if="primaryArg(call.input)" #inline-result>{{
      primaryArg(call.input)
    }}</template>
    <ToolDetails :item="item" />
  </LogRow>
</template>
