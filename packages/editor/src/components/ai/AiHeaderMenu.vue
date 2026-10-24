<script setup lang="ts">
import { Sparkles } from "@lucide/vue";
import { computed } from "vue";
import type { UseAiFeatureReturn } from "../../composables/useAiFeature";
import { useI18n } from "../../composables/useI18n";

const props = defineProps<{
  feature: Pick<
    UseAiFeatureReturn,
    "panel" | "isAvailable" | "has" | "open" | "close"
  >;
}>();

const { t } = useI18n();
const isActive = computed(() => props.feature.panel.value === "chat");

function toggle(): void {
  if (isActive.value) props.feature.close();
  else props.feature.open("chat");
}
</script>

<template>
  <button
    v-if="feature.isAvailable.value && feature.has('chat')"
    type="button"
    data-testid="ai-menu-trigger"
    :aria-pressed="isActive"
    :aria-label="t.ai.menu.chat"
    :title="t.ai.menu.chat"
    class="tpl-ai-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-4 tpl:py-2 tpl:text-sm tpl:font-semibold tpl:whitespace-nowrap tpl:transition-all tpl:duration-200"
    :class="isActive ? 'tpl-ai-btn--active' : 'tpl-ai-btn--idle'"
    @click.stop="toggle"
  >
    <Sparkles
      :size="16"
      :stroke-width="2"
      class="tpl-ai-btn-icon"
      aria-hidden="true"
    />
    {{ t.ai.menu.button }}
  </button>
</template>
