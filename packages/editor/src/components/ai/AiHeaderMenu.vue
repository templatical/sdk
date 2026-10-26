<script setup lang="ts">
import { Sparkles } from "@lucide/vue";
import { computed } from "vue";
import type { UseAiFeatureReturn } from "../../composables/useAiFeature";
import { useI18n } from "../../composables/useI18n";
import { secondaryBtnCompactClass } from "../../constants/styleConstants";

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
  <!-- The header's shared compact recipe, like Comments and test email, so the
       row keeps one height, size and weight and Save stays its only amber
       surface. The amber is on the icon alone: `--tpl-primary-hover` is 3.64:1
       on `--tpl-bg`, clearing the 3:1 non-text floor that `--tpl-primary`
       (2.76:1) misses. Open, it takes the Comments button's open fill. -->
  <button
    v-if="feature.isAvailable.value && feature.has('chat')"
    type="button"
    data-testid="ai-menu-trigger"
    :aria-pressed="isActive"
    :aria-label="t.ai.menu.chat"
    :title="t.ai.menu.chat"
    :class="secondaryBtnCompactClass"
    :style="
      isActive
        ? {
            backgroundColor: 'var(--tpl-primary-light)',
            borderColor: 'var(--tpl-primary-light)',
          }
        : undefined
    "
    @click.stop="toggle"
  >
    <Sparkles
      :size="16"
      :stroke-width="2"
      class="tpl:text-[var(--tpl-primary-hover)]"
      aria-hidden="true"
    />
    {{ t.ai.menu.button }}
  </button>
</template>
