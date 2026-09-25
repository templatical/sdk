<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import { ChevronRight } from "@lucide/vue";
import { format, usePlaygroundI18n } from "@/i18n";

const props = defineProps<{
  ready: boolean;
}>();

const { t } = usePlaygroundI18n();

const dismissed = useLocalStorage("tpl-playground-host-tour-dismissed", false);
const stepIndex = ref(0);
const targetRect = ref<DOMRect | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const nextRef = ref<HTMLButtonElement | null>(null);

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

/**
 * It is a modal, so it behaves like one: focus lands on Next, Tab cycles
 * inside, Escape dismisses from anywhere (focus-trap listens on the
 * document; a key handler on the scrim never fires because nothing there
 * takes focus), and focus goes back where it was on close.
 */
const { activate, deactivate } = useFocusTrap(dialogRef, {
  initialFocus: () => nextRef.value ?? false,
  allowOutsideClick: true,
  escapeDeactivates: true,
  returnFocusOnDeactivate: true,
  onDeactivate() {
    if (!dismissed.value) dismiss();
  },
});

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

/** Matches the tooltip's `w-[300px]`. */
const TOOLTIP_WIDTH = 300;

/**
 * Positioned with top/bottom/left only, never `transform`: the entrance
 * animation (`pg-onboarding-tooltip-in`, fill-mode both) owns transform and
 * silently overrides one set here, which is how an "above" tooltip landed
 * on top of the block palette.
 */
const tooltipStyle = computed(() => {
  const rect = targetRect.value;
  if (!rect) return {};
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  // The frame step spotlights the whole editor. Anchor it inside the frame,
  // bottom centre: clear of the block palette and the settings panel.
  if (currentStep.value === "frame") {
    return {
      bottom: `${viewportHeight - rect.bottom + 24}px`,
      left: `${Math.max(12, rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2)}px`,
    };
  }
  const gap = 12;
  const left = `${Math.max(12, Math.min(rect.left, viewportWidth - TOOLTIP_WIDTH - 20))}px`;
  const below = rect.bottom + gap + 180 < viewportHeight;
  return below
    ? { top: `${rect.bottom + gap}px`, left }
    : { bottom: `${viewportHeight - rect.top + gap}px`, left };
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

watch(
  () => Boolean(active.value && targetRect.value),
  async (open) => {
    if (open) {
      await nextTick();
      activate();
    } else {
      deactivate();
    }
  },
);

onUnmounted(() => {
  deactivate();
  targetRect.value = null;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="active && targetRect"
      class="fixed inset-0 z-[10001]"
      @click.self="dismiss"
    >
      <div
        class="pg-onboarding-spotlight absolute top-0 left-0 pointer-events-none"
        :style="spotlightStyle"
      />
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="host-tour-title"
        aria-describedby="host-tour-text"
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
            id="host-tour-title"
            class="text-[15px] font-semibold text-gray-900 mb-1.5 dark:text-gray-100"
          >
            {{ stepCopy.title }}
          </div>
          <div
            id="host-tour-text"
            aria-live="polite"
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
            class="rounded-md text-[13px] text-gray-500 bg-transparent border-none cursor-pointer font-sans transition-colors duration-150 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-gray-400 dark:hover:text-gray-100"
            @click="dismiss"
          >
            {{ t.host.tour.skip }}
          </button>
          <button
            type="button"
            ref="nextRef"
            data-testid="onboarding-next"
            class="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-primary text-on-primary text-[13px] font-medium font-sans border-none cursor-pointer transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:bg-primary-dark dark:hover:bg-primary-dark-hover"
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
