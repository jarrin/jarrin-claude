<script setup lang="ts">
import type { CommandOutcome, HostCommand, HostView } from "#shared/protocol";

/**
 * Every machine running `claudjar service`, with the projects it offers and an
 * open / close toggle per project, plus the latest command outcomes.
 */
defineProps<{
  hosts: readonly HostView[];
  outcomes: readonly CommandOutcome[];
}>();
defineEmits<{ command: [host: string, command: HostCommand] }>();

const describe = (o: CommandOutcome): string =>
  `${o.command.type} ${o.command.project} @ ${o.host}: ${o.ok ? "ok" : o.error}`;
</script>

<template>
  <div class="grid content-start gap-4 overflow-y-auto p-3">
    <p v-if="!hosts.length" class="text-muted">
      No hosts yet. Run <UKbd value="claudjar service run" /> with
      <UKbd value="monitor:" /> set in /etc/claudjar.conf.
    </p>
    <section v-for="h in hosts" :key="h.host" class="grid gap-2">
      <h2 class="flex items-center gap-2 font-semibold">
        <span
          :class="[
            'size-2 rounded-full',
            h.online ? 'bg-success' : 'bg-dimmed',
          ]"
        />
        {{ h.host }}
        <span class="text-xs font-normal text-muted">
          {{ h.projects.length }} project(s){{ h.online ? "" : " · offline" }}
        </span>
      </h2>
      <ul class="grid gap-1">
        <li
          v-for="p in h.projects"
          :key="p.name"
          class="flex items-center gap-3 text-sm"
        >
          <UButton
            size="xs"
            :color="p.active ? 'primary' : 'neutral'"
            :variant="p.active ? 'solid' : 'subtle'"
            :disabled="!h.online"
            :label="p.active ? 'close' : 'open'"
            @click="
              $emit('command', h.host, {
                type: p.active ? 'close-project' : 'open-project',
                project: p.name,
              })
            "
          />
          <span class="font-mono">{{ p.name }}</span>
          <span class="text-xs text-muted">
            {{ p.configured ? "claudjar" : "unconfigured"
            }}{{ p.backlogRepo ? ` · ${p.backlogRepo}` : "" }}
          </span>
        </li>
      </ul>
    </section>
    <section v-if="outcomes.length" class="grid gap-1 text-xs">
      <h2 class="font-semibold text-muted">Commands</h2>
      <p
        v-for="o in [...outcomes].reverse()"
        :key="o.id"
        :class="o.ok ? 'text-muted' : 'text-error'"
      >
        {{ describe(o) }}
      </p>
    </section>
  </div>
</template>
