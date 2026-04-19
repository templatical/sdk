<script setup lang="ts">
import type { Collaborator } from "@templatical/types";
import { useI18n } from "../../composables";
import { Wifi, WifiOff } from "@lucide/vue";
import { computed } from "vue";
import { readableTextColor } from "../../utils/readableTextColor";

const props = defineProps<{
  collaborators: Collaborator[];
  isConnected: boolean;
}>();

const { t } = useI18n();

const maxVisible = 3;

const visibleCollaborators = computed(() =>
  props.collaborators.slice(0, maxVisible),
);

const overflowCollaborators = computed(() =>
  props.collaborators.slice(maxVisible),
);

const overflowCount = computed(() => overflowCollaborators.value.length);

const overflowNames = computed(() =>
  overflowCollaborators.value.map((c) => c.name).join("\n"),
);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}
</script>

<template>
  <div class="tpl-collaborator-bar tpl:flex tpl:items-center tpl:gap-2">
    <!-- Connection indicator -->
    <div
      class="tpl:flex tpl:items-center tpl:gap-1 tpl:text-[11px]"
      :style="{
        color: isConnected ? 'var(--tpl-success)' : 'var(--tpl-text-muted)',
      }"
      :title="
        isConnected ? t.collaboration.connected : t.collaboration.disconnected
      "
    >
      <Wifi v-if="isConnected" :size="12" :stroke-width="2" />
      <WifiOff v-else :size="12" :stroke-width="2" />
    </div>

    <!-- Avatar stack -->
    <div
      v-if="collaborators.length > 0"
      class="tpl:flex tpl:items-center tpl:-space-x-1.5"
    >
      <div
        v-for="collaborator in visibleCollaborators"
        :key="collaborator.id"
        class="tpl-collaborator-avatar tpl:relative tpl:flex tpl:size-6 tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-2 tpl:text-[10px] tpl:font-bold tpl:transition-transform tpl:duration-150 tpl:hover:z-10 tpl:hover:scale-110 tpl:border-[var(--tpl-bg)]"
        :style="{
          backgroundColor: collaborator.color,
          color: readableTextColor(collaborator.color),
        }"
        :title="collaborator.name"
      >
        {{ getInitials(collaborator.name) }}
      </div>
      <div
        v-if="overflowCount > 0"
        class="tpl:relative tpl:flex tpl:size-6 tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-2 tpl:text-[9px] tpl:font-bold tpl:border-[var(--tpl-bg)] tpl:bg-[var(--tpl-bg-hover)] tpl:text-[var(--tpl-text-muted)]"
        :title="overflowNames"
      >
        +{{ overflowCount }}
      </div>
    </div>
  </div>
</template>
