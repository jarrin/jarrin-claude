<script setup lang="ts">
import { instanceLabel } from "#shared/protocol";

const { instances, connected, dismiss } = useMonitor();

const activeId = ref<string | null>(null);
/** Lines seen per tab, for the unread counter on the others. */
const seen = ref<Record<string, number>>({});

const active = computed(
  () => instances.value.find((i) => i.id === activeId.value) ?? null,
);

// Open the first tab by default, and fall back when the active one is dismissed.
watch(
  instances,
  (list) => {
    if (!list.some((i) => i.id === activeId.value))
      activeId.value = list[0]?.id ?? null;
    const a = active.value;
    if (a) seen.value[a.id] = a.lines.length;
  },
  { immediate: true },
);

const unread = (id: string, total: number): number =>
  Math.max(0, total - (seen.value[id] ?? 0));
</script>

<template>
  <div class="shell">
    <header>
      <span class="brand">claudjar loops</span>
      <nav class="tabs">
        <button
          v-for="inst in instances"
          :key="inst.id"
          :class="['tab', { active: inst.id === activeId }]"
          :title="`${inst.repo} · pid ${inst.pid}`"
          @click="activeId = inst.id"
        >
          <span :class="['dot', inst.online ? 'on' : 'off']" />
          {{ instanceLabel(inst) }}
          <span
            v-if="inst.id !== activeId && unread(inst.id, inst.lines.length)"
            class="badge"
            >{{ unread(inst.id, inst.lines.length) }}</span
          >
          <span
            v-if="!inst.online"
            class="close"
            title="Dismiss"
            @click.stop="dismiss(inst.id)"
            >×</span
          >
        </button>
      </nav>
      <span :class="['conn', connected ? 'on' : 'off']">
        {{ connected ? "live" : "reconnecting…" }}
      </span>
    </header>
    <main v-if="active">
      <div class="meta">
        <span>{{ active.repo }}</span>
        <span>{{ active.host }} · pid {{ active.pid }}</span>
        <span :class="['status', active.online ? 'on' : 'off']">
          {{ active.online ? active.status : `offline — ${active.status}` }}
        </span>
      </div>
      <LogView :key="active.id" :lines="active.lines" />
    </main>
    <main v-else class="none">
      No loops connected. Start one with
      <code>claudjar loop &lt;milestone&gt;</code> and
      <code>CLAUDJAR_MONITOR_URL</code> set.
    </main>
  </div>
</template>
