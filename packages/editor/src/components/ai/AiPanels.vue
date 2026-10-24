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
    enter-active-class="tpl-ai-slide-enter-active"
    enter-from-class="tpl:translate-x-full"
    enter-to-class="tpl:translate-x-0"
    leave-active-class="tpl-ai-slide-leave-active"
    leave-from-class="tpl:translate-x-0"
    leave-to-class="tpl:translate-x-full"
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

<style scoped>
.tpl-ai-slide-enter-active {
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-ai-slide-leave-active {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .tpl-ai-slide-enter-active,
  .tpl-ai-slide-leave-active {
    transition: none;
  }
}
</style>
