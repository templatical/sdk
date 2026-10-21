<script setup lang="ts">
import type { CollaborationConnectionState } from "@templatical/types";
import { Wifi, WifiOff } from "@lucide/vue";
import { computed } from "vue";
import type { CollaborationPerson } from "../../composables/useCollaborationFeature";
import { useI18n } from "../../composables/useI18n";
import { readableTextColor } from "../../utils/readableTextColor";

const props = defineProps<{
  /** Everyone else with the template open, one entry per person. */
  people: CollaborationPerson[];
  /** `null` while no realtime join has happened. */
  connection: CollaborationConnectionState | null;
}>();

const { t } = useI18n();

const MAX_VISIBLE = 3;

const visiblePeople = computed(() => props.people.slice(0, MAX_VISIBLE));
const overflowPeople = computed(() => props.people.slice(MAX_VISIBLE));
const overflowNames = computed(() =>
  overflowPeople.value.map(displayName).join("\n"),
);

const isConnected = computed(() => props.connection === "connected");
const connectionLabel = computed(() => {
  if (props.connection === "connected") return t.collaboration.connected;
  if (props.connection === "reconnecting") return t.collaboration.reconnecting;
  return t.collaboration.offline;
});

/** A guest's name comes from the server in English; the bar uses its own word. */
function displayName(person: CollaborationPerson): string {
  return person.type === "guest" || person.name.trim() === ""
    ? t.collaboration.guest
    : person.name;
}

function initials(person: CollaborationPerson): string {
  const parts = displayName(person).trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}
</script>

<template>
  <div
    data-testid="collaborator-bar"
    role="group"
    :aria-label="t.collaboration.people"
    class="tpl-collaborator-bar tpl:flex tpl:items-center tpl:gap-2"
  >
    <span
      data-testid="collaborator-connection"
      :data-state="connection ?? 'none'"
      class="tpl:flex tpl:items-center tpl:text-xs"
      :style="{
        color: isConnected ? 'var(--tpl-success)' : 'var(--tpl-text-muted)',
      }"
      :title="connectionLabel"
    >
      <Wifi
        v-if="isConnected"
        :size="12"
        :stroke-width="2"
        aria-hidden="true"
      />
      <WifiOff v-else :size="12" :stroke-width="2" aria-hidden="true" />
      <span class="tpl:sr-only">{{ connectionLabel }}</span>
    </span>

    <div class="tpl:flex tpl:items-center tpl:-space-x-1.5">
      <span
        v-for="person in visiblePeople"
        :key="person.key"
        data-testid="collaborator-avatar"
        :data-person-type="person.type"
        class="tpl-collaborator-avatar tpl:relative tpl:flex tpl:size-6 tpl:items-center tpl:justify-center tpl:overflow-hidden tpl:rounded-full tpl:border-2 tpl:border-[var(--tpl-bg)] tpl:text-[10px] tpl:font-bold tpl:transition-transform tpl:hover:z-10 tpl:hover:scale-110"
        :style="{
          backgroundColor: person.color,
          color: readableTextColor(person.color),
          boxShadow: `0 0 0 1px ${person.color}`,
        }"
        :title="displayName(person)"
      >
        <img
          v-if="person.avatarUrl"
          :src="person.avatarUrl"
          alt=""
          class="tpl:size-full tpl:object-cover"
        />
        <span v-else aria-hidden="true">{{ initials(person) }}</span>
        <span class="tpl:sr-only">{{ displayName(person) }}</span>
      </span>
      <span
        v-if="overflowPeople.length > 0"
        data-testid="collaborator-overflow"
        class="tpl:relative tpl:flex tpl:size-6 tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-2 tpl:border-[var(--tpl-bg)] tpl:bg-[var(--tpl-bg-hover)] tpl:text-[10px] tpl:font-bold tpl:text-[var(--tpl-text-muted)]"
        :title="overflowNames"
      >
        +{{ overflowPeople.length }}
      </span>
    </div>
  </div>
</template>
