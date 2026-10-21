<script setup lang="ts">
import { ImageUp, ShieldCheck, Sparkles } from "@lucide/vue";
import { computed, ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import type {
  AiPanel,
  UseAiFeatureReturn,
} from "../../composables/useAiFeature";
import { useI18n } from "../../composables/useI18n";

const props = defineProps<{
  feature: Pick<
    UseAiFeatureReturn,
    "panel" | "isAvailable" | "has" | "open" | "close"
  >;
}>();

const { t } = useI18n();
const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);
onClickOutside(root, () => (isOpen.value = false));

const ITEMS = [
  { panel: "chat", feature: "chat", icon: Sparkles },
  { panel: "design", feature: "design", icon: ImageUp },
  { panel: "scoring", feature: "score", icon: ShieldCheck },
] as const;

const items = computed(() =>
  ITEMS.filter((item) => props.feature.has(item.feature)),
);
const isActive = computed(
  () => isOpen.value || props.feature.panel.value !== null,
);

function title(panel: AiPanel): string {
  return panel === "chat"
    ? t.ai.menu.chat
    : panel === "design"
      ? t.ai.menu.design
      : t.ai.menu.scoring;
}

function description(panel: AiPanel): string {
  return panel === "chat"
    ? t.ai.menu.chatDescription
    : panel === "design"
      ? t.ai.menu.designDescription
      : t.ai.menu.scoringDescription;
}

function choose(panel: AiPanel): void {
  isOpen.value = false;
  if (props.feature.panel.value === panel) props.feature.close();
  else props.feature.open(panel);
}
</script>

<template>
  <div
    v-if="feature.isAvailable.value && items.length > 0"
    ref="root"
    class="tpl:relative"
  >
    <button
      type="button"
      data-testid="ai-menu-trigger"
      :aria-expanded="isOpen"
      class="tpl-ai-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-4 tpl:py-2 tpl:text-sm tpl:font-semibold tpl:whitespace-nowrap tpl:transition-all tpl:duration-200"
      :class="isActive ? 'tpl-ai-btn--active' : 'tpl-ai-btn--idle'"
      @click.stop="isOpen = !isOpen"
    >
      <Sparkles
        :size="16"
        :stroke-width="2"
        class="tpl-ai-btn-icon"
        aria-hidden="true"
      />
      {{ t.ai.menu.button }}
    </button>
    <Transition
      enter-active-class="tpl:transition-all tpl:ease-out"
      enter-from-class="tpl:scale-95 tpl:opacity-0"
      enter-to-class="tpl:scale-100 tpl:opacity-100"
      leave-active-class="tpl:transition-all tpl:duration-100 tpl:ease-in"
      leave-from-class="tpl:scale-100 tpl:opacity-100"
      leave-to-class="tpl:scale-95 tpl:opacity-0"
    >
      <div
        v-if="isOpen"
        class="tpl:absolute tpl:right-0 tpl:top-full tpl:z-50 tpl:mt-1 tpl:origin-top-right"
      >
        <div
          class="tpl-ai-feature-menu tpl:w-[280px] tpl:overflow-hidden tpl:rounded-[var(--tpl-radius)] tpl:py-1 tpl:bg-[var(--tpl-bg)] tpl:border tpl:border-[var(--tpl-border)] tpl:shadow-[var(--tpl-shadow-lg)]"
        >
          <button
            v-for="item in items"
            :key="item.panel"
            type="button"
            :data-testid="`ai-menu-item-${item.panel}`"
            class="tpl-ai-feature-menu-item tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-start tpl:gap-3 tpl:border-none tpl:px-3 tpl:py-2.5 tpl:text-left tpl:transition-colors"
            :style="{
              backgroundColor:
                feature.panel.value === item.panel
                  ? 'var(--tpl-primary-light)'
                  : 'transparent',
            }"
            @click="choose(item.panel)"
          >
            <div
              class="tpl:mt-0.5 tpl:flex tpl:size-7 tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)]"
              :style="{
                backgroundColor:
                  feature.panel.value === item.panel
                    ? 'var(--tpl-primary)'
                    : 'var(--tpl-bg-active)',
                color:
                  feature.panel.value === item.panel
                    ? 'var(--tpl-bg)'
                    : 'var(--tpl-text-muted)',
              }"
            >
              <component
                :is="item.icon"
                :size="15"
                :stroke-width="2"
                aria-hidden="true"
              />
            </div>
            <div class="tpl:flex tpl:min-w-0 tpl:flex-col tpl:gap-0.5">
              <span
                class="tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text)]"
                >{{ title(item.panel) }}</span
              >
              <span
                class="tpl:text-xs tpl:leading-snug tpl:text-[var(--tpl-text-muted)]"
                >{{ description(item.panel) }}</span
              >
            </div>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tpl-ai-feature-menu-item:hover {
  background-color: var(--tpl-bg-hover) !important;
}
</style>
