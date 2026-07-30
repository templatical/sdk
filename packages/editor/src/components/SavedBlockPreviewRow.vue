<script setup lang="ts">
/**
 * One reorderable row in the save dialog's preview list: a grip handle beside a
 * scaled-down render of the real block.
 *
 * The preview is the same `BlockPreviewCanvas` the browser modal uses, so
 * a row shows what the block actually looks like rather than a description of
 * it. That canvas is fixed at the 600px email width every block component
 * renders against, so the row shrinks it with `transform: scale()` instead of
 * re-flowing it at dialog width — a re-flow would show a layout the recipient
 * will never see.
 *
 * `transform` doesn't participate in layout, so the frame would keep reserving
 * the full unscaled height; a `ResizeObserver` mirrors the scaled height back
 * onto it. The handle is a sibling of the scaled subtree, so it stays full size
 * and keeps its real hit area.
 *
 * Row chrome uses the raw theme tokens, not the `--tpl-chrome-*` aliases: the
 * chrome is an ancestor and a sibling of the rendered email content, never a
 * descendant, so the `.tpl-block-content` token override can't reach it.
 */
import BlockPreviewCanvas from "./BlockPreviewCanvas.vue";
import { useI18n } from "../composables";
import { CUSTOM_BLOCK_DEFINITIONS_KEY, EDITOR_KEY } from "../keys";
import { getEmailFrameWidth } from "../utils/emailFrameWidth";
import { getBlockLabel } from "../utils/blockTypeLabels";
import { ChevronDown, ChevronUp, GripVertical } from "@lucide/vue";
import type { Block } from "@templatical/types";
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{
  block: Block;
  /** 1-based position in the list — spoken by the handle's label. */
  position: number;
  total: number;
}>();

const emit = defineEmits<{
  (e: "move", delta: -1 | 1): void;
}>();

const { t, format } = useI18n();
// Optional: absent when the consumer registers no custom blocks.
const customBlockDefinitions = inject(CUSTOM_BLOCK_DEFINITIONS_KEY, []);

const editor = inject(EDITOR_KEY, null);

/**
 * The width the nested `BlockPreviewCanvas` actually renders at.
 *
 * MUST come from the same helper the canvas uses, because the scale factor below
 * divides by it: a mismatch scales every row by the wrong amount, so a template
 * with a custom body width would overflow its frame or under-fill it. Rows are
 * always the desktop width — the save dialog has no viewport control.
 */
const previewWidth = computed(() =>
  getEmailFrameWidth(editor?.content.value.settings),
);
/**
 * Collapsed height for a tall block. A hero card or a multi-row section would
 * otherwise be taller than the whole list, leaving one row on screen — and
 * seeing the rows together is what makes them orderable. Anything taller
 * collapses to this, fades out at the cut, and can be expanded in place.
 */
const COLLAPSED_HEIGHT = 240;

const frameEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);
const scale = ref(1);
/** Scaled height of the whole block; `null` until first measured. */
const fullHeight = ref<number | null>(null);
const expanded = ref(false);

let observer: ResizeObserver | null = null;

/** Only a block taller than the collapsed cap needs fading or expanding. */
const isClipped = computed(
  () => fullHeight.value !== null && fullHeight.value > COLLAPSED_HEIGHT,
);

const frameHeight = computed(() => {
  if (fullHeight.value === null) return null;
  if (expanded.value || !isClipped.value) return fullHeight.value;
  return COLLAPSED_HEIGHT;
});

function measure(): void {
  const frame = frameEl.value;
  const content = contentEl.value;
  if (!frame || !content) return;
  const width = frame.clientWidth;
  if (width <= 0) return;
  // Never scale up: a dialog wider than the email would blow the preview past
  // its real proportions.
  const next = Math.min(1, width / previewWidth.value);
  scale.value = next;
  fullHeight.value = content.offsetHeight * next;
}

onMounted(() => {
  measure();
  // Absent in non-DOM test environments. Without it the frame simply falls back
  // to the untransformed height and clips — degraded, never broken.
  if (typeof ResizeObserver === "undefined") return;
  observer = new ResizeObserver(() => measure());
  if (frameEl.value) observer.observe(frameEl.value);
  if (contentEl.value) observer.observe(contentEl.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

const blockLabel = computed(() =>
  getBlockLabel(props.block, t, customBlockDefinitions),
);

const handleLabel = computed(() =>
  format(t.savedBlocks.reorderHandle, {
    block: blockLabel.value,
    position: props.position,
    total: props.total,
  }),
);

const toggleLabel = computed(() =>
  format(
    expanded.value
      ? t.savedBlocks.collapsePreview
      : t.savedBlocks.expandPreview,
    { block: blockLabel.value },
  ),
);
</script>

<template>
  <div
    data-testid="saved-blocks-reorder-row"
    :data-block-id="block.id"
    class="tpl:flex tpl:items-start tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-md)] tpl:border tpl:p-1.5 tpl:border-[var(--tpl-border)]"
    style="background-color: var(--tpl-bg)"
  >
    <!-- Sortable's `handle` selector points here, so a pointer-drag can only
         start from the grip — never from the preview itself. -->
    <button
      type="button"
      data-testid="saved-blocks-reorder-handle"
      class="tpl-saved-block-reorder-handle tpl:mt-0.5 tpl:shrink-0 tpl:cursor-grab tpl:rounded tpl:border-none tpl:bg-transparent tpl:p-0.5 tpl:text-[var(--tpl-text-dim)]"
      :aria-label="handleLabel"
      :title="t.savedBlocks.reorderHint"
      @keydown.up.prevent="emit('move', -1)"
      @keydown.down.prevent="emit('move', 1)"
    >
      <GripVertical :size="14" :stroke-width="1.5" />
    </button>

    <div class="tpl:relative tpl:min-w-0 tpl:flex-1">
      <div
        ref="frameEl"
        class="tpl:overflow-hidden"
        :style="{
          height: frameHeight !== null ? `${frameHeight}px` : undefined,
        }"
      >
        <div
          ref="contentEl"
          :style="{
            width: `${previewWidth}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }"
        >
          <BlockPreviewCanvas :blocks="[block]" />
        </div>
      </div>

      <!-- Fade over the cut, so a clipped block reads as truncated rather than
           as a block that simply ends there. Pointer-transparent: it sits over
           the preview, and swallowing clicks would break the row. -->
      <div
        v-if="isClipped && !expanded"
        data-testid="saved-blocks-preview-fade"
        aria-hidden="true"
        class="tpl:pointer-events-none tpl:absolute tpl:inset-x-0 tpl:bottom-0 tpl:h-10"
        style="
          background: linear-gradient(
            to bottom,
            transparent,
            var(--tpl-bg) 90%
          );
        "
      />

      <button
        v-if="isClipped"
        type="button"
        data-testid="saved-blocks-preview-toggle"
        class="tpl:absolute tpl:bottom-1 tpl:right-1 tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-0.5 tpl:rounded tpl:border tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:text-[var(--tpl-text-muted)]"
        :aria-label="toggleLabel"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <component
          :is="expanded ? ChevronUp : ChevronDown"
          :size="11"
          :stroke-width="2"
        />
        {{ expanded ? t.savedBlocks.collapse : t.savedBlocks.expand }}
      </button>
    </div>
  </div>
</template>
