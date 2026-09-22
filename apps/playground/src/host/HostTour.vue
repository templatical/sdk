<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { ChevronRight } from "@lucide/vue";
import { format, usePlaygroundI18n } from "@/i18n";

const props = defineProps<{
  ready: boolean;
}>();

const { t } = usePlaygroundI18n();

const dismissed = useLocalStorage("tpl-playground-host-tour-dismissed", false);
const stepIndex = ref(0);
const targetRect = ref<DOMRect | null>(null);

const STEPS = ["frame", "code", "docs"] as const;
type TourStep = (typeof STEPS)[number];

const SELECTOR: Record<TourStep, string> = {
  frame: '[data-testid="editor-stage"]',
  code: '[data-testid="toolbar-code"]',
  docs: '[data-testid="toolbar-docs"]',
};

const active = computed(
  () => props.ready && !dismissed.value && stepIndex.value < STEPS.length,
);

const currentStep = computed(() => STEPS[stepIndex.value] ?? "frame");

const stepCopy = computed(() => t.value.host.tour[currentStep.value]);

function measure(): void {
  if (!active.value) {
    targetRect.value = null;
    return;
  }
  const el = document.querySelector(SELECTOR[currentStep.value]);
  targetRect.value = el?.getBoundingClientRect() ?? null;
}

function dismiss(): void {
  dismissed.value = true;
  targetRect.value = null;
}

function next(): void {
  if (stepIndex.value >= STEPS.length - 1) {
    dismiss();
    return;
  }
  stepIndex.value += 1;
  nextTick(measure);
}

const spotlightStyle = computed(() => {
  const rect = targetRect.value;
  if (!rect) return {};
  const pad = currentStep.value === "frame" ? 6 : 4;
  return {
    width: `${rect.width + pad * 2}px`,
    height: `${rect.height + pad * 2}px`,
    transform: `translate(${rect.left - pad}px, ${rect.top - pad}px)`,
    borderRadius: currentStep.value === "frame" ? "14px" : "8px",
  };
});

const tooltipStyle = computed(() => {
  const rect = targetRect.value;
  if (!rect) return {};
  const gap = 12;
  const below = rect.bottom + gap + 180 < window.innerHeight;
  return below
    ? {
        top: `${rect.bottom + gap}px`,
        left: `${Math.min(rect.left, window.innerWidth - 320)}px`,
      }
    : {
        top: `${Math.max(12, rect.top - gap)}px`,
        left: `${Math.min(rect.left, window.innerWidth - 320)}px`,
        transform: "translateY(-100%)",
      };
});

watch(
  () => [active.value, currentStep.value] as const,
  () => {
    nextTick(measure);
  },
  { immediate: true },
);

watch(
  () => props.ready,
  (ready) => {
    if (ready && !dismissed.value) nextTick(measure);
  },
);

onUnmounted(() => {
  targetRect.value = null;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="active && targetRect"
      class="fixed inset-0 z-[10001]"
      @click.self="dismiss"
      @keydown.escape="dismiss"
    >
      <div
        class="pg-onboarding-spotlight absolute top-0 left-0 pointer-events-none"
        :style="spotlightStyle"
      />
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="stepCopy.title"
        data-testid="host-tour"
        class="pg-onboarding-tooltip fixed z-[10002] w-[300px] bg-white rounded-xl shadow-modal-sm overflow-hidden dark:bg-gray-800"
        :style="tooltipStyle"
      >
        <div class="px-4 pt-4 pb-3">
          <div
            class="text-xs font-medium text-primary mb-1 tracking-wide uppercase"
          >
            {{
              format(t.host.tour.stepCounter, {
                current: String(stepIndex + 1),
                total: String(STEPS.length),
              })
            }}
          </div>
          <div
            class="text-[15px] font-semibold text-gray-900 mb-1.5 dark:text-gray-100"
          >
            {{ stepCopy.title }}
          </div>
          <div
            class="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed"
          >
            {{ stepCopy.text }}
          </div>
        </div>
        <div
          class="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
        >
          <button
            type="button"
            data-testid="onboarding-skip"
            class="text-[13px] text-gray-400 bg-transparent border-none cursor-pointer font-sans transition-colors duration-150 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            @click="dismiss"
          >
            {{ t.host.tour.skip }}
          </button>
          <button
            type="button"
            data-testid="onboarding-next"
            class="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-primary text-white text-[13px] font-medium font-sans border-none cursor-pointer transition-all duration-150 hover:bg-primary-hover"
            @click="next"
          >
            {{
              stepIndex < STEPS.length - 1 ? t.host.tour.next : t.host.tour.done
            }}
            <ChevronRight
              v-if="stepIndex < STEPS.length - 1"
              :size="12"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
