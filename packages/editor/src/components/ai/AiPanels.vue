<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import type { UseAiFeatureReturn } from "../../composables/useAiFeature";

const AiChatPanel = defineAsyncComponent(() => import("./AiChatPanel.vue"));

const props = defineProps<{ feature: UseAiFeatureReturn }>();

const PANELS = {
  chat: AiChatPanel,
} as const;

const current = computed(() => {
  const panel = props.feature.panel.value;
  return panel !== null && panel in PANELS
    ? PANELS[panel as keyof typeof PANELS]
    : null;
});
</script>

<template>
  <Transition
    enter-active-class="tpl-panel-enter-active"
    leave-active-class="tpl-panel-leave-active"
    mode="out-in"
  >
    <!-- Keep chat state when the panel closes. -->
    <KeepAlive>
      <component
        :is="current"
        v-if="current"
        :key="feature.panel.value ?? 'none'"
        :feature="feature"
        @close="feature.close()"
      />
    </KeepAlive>
  </Transition>
</template>
