<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { useCloudI18n } from "../composables/useCloudI18n";
import type {
  Block,
  Collaborator,
  CustomBlock as CustomBlockType,
  TemplateContent,
  ViewportSize,
} from "@templatical/types";
import { ImageUp, Sparkles, SquarePlus } from "@lucide/vue";
import { computed, inject, provide, ref, type Component } from "vue";
import {
  EDITOR_KEY,
  APPLIES_CONDITION_FILTER_KEY,
  CONDITION_PREVIEW_KEY,
  BLOCK_REGISTRY_KEY,
  CAPABILITIES_KEY,
  MERGE_TAG_SAMPLE_MODE_KEY,
  PREVIEW_RESOLUTION_KEY,
  USE_MERGE_TAG_SAMPLES_KEY,
  requireInject,
} from "../keys";
import { VueDraggable } from "vue-draggable-plus";
import {
  getDocumentStyle,
  resolveBlockComponent,
} from "../utils/blockComponentResolver";
import {
  EMAIL_FRAME_WIDTH_TRANSITION,
  getEmailFrameWidth,
} from "../utils/emailFrameWidth";
import { readableTextColor } from "../utils/readableTextColor";

import BlockWrapper from "./blocks/BlockWrapper.vue";
import SectionBlock from "./blocks/SectionBlock.vue";
import TitleBlock from "./blocks/TitleBlock.vue";
import ParagraphBlock from "./blocks/ParagraphBlock.vue";
import ImageBlock from "./blocks/ImageBlock.vue";
import ButtonBlock from "./blocks/ButtonBlock.vue";
import DividerBlock from "./blocks/DividerBlock.vue";
import SpacerBlock from "./blocks/SpacerBlock.vue";
import HtmlBlock from "./blocks/HtmlBlock.vue";
import SocialIconsBlock from "./blocks/SocialIconsBlock.vue";
import MenuBlock from "./blocks/MenuBlock.vue";
import TableBlock from "./blocks/TableBlock.vue";
import CustomBlock from "./blocks/CustomBlock.vue";
import VideoBlock from "./blocks/VideoBlock.vue";

// `countdown` is deliberately absent: it resolves from the block registry, which
// `useEditorCore` populates with a lazy `defineAsyncComponent` so OSS bundles
// don't carry a Cloud-only block. `resolveBlockComponent` checks the registry
// first, so a static entry here would never be reached — but its static import
// would still pull the module into the eager graph and defeat the laziness.
// The other fallback maps (SectionBlock, BlockPreviewCanvas,
// PreviewSectionBlock) omit it for the same reason.
const blockComponentMap: Record<string, Component> = {
  section: SectionBlock,
  title: TitleBlock,
  paragraph: ParagraphBlock,
  image: ImageBlock,
  button: ButtonBlock,
  divider: DividerBlock,
  spacer: SpacerBlock,
  html: HtmlBlock,
  social: SocialIconsBlock,
  menu: MenuBlock,
  table: TableBlock,
  video: VideoBlock,
  custom: CustomBlock,
};

const props = defineProps<{
  viewport: ViewportSize;
  content: TemplateContent;
  selectedBlockId: string | null;
  darkMode: boolean;
  previewMode: boolean;
  lockedBlocks?: Map<string, Collaborator>;
}>();

const emit = defineEmits<{
  (e: "select-block", blockId: string | null): void;
  (e: "open-ai-chat"): void;
  (e: "open-design-reference"): void;
}>();

const { t } = useI18n();
const { t: cloudT } = useCloudI18n();

const editor = requireInject(EDITOR_KEY, "Canvas");
const conditionPreview = inject(CONDITION_PREVIEW_KEY, null);
const blockRegistry = inject(BLOCK_REGISTRY_KEY, null);

const caps = inject(CAPABILITIES_KEY, {});

/**
 * Merge-tag samples render on this canvas **only while preview mode is on**.
 * The `previewMode &&` is the load-bearing half: the canvas is the editing
 * surface, and substituted text in a block a user is about to edit would be
 * text they never wrote. Preview mode is already fully non-editing (clicks and
 * dragging are blocked above), so it is the one state where swapping the
 * displayed value is safe.
 */
const mergeTagSampleMode = inject(MERGE_TAG_SAMPLE_MODE_KEY, null);
// Null in headless mounts and when no resolver is configured.
const previewResolution = inject(PREVIEW_RESOLUTION_KEY, null);
provide(
  USE_MERGE_TAG_SAMPLES_KEY,
  computed(
    () =>
      props.previewMode &&
      (mergeTagSampleMode?.value ?? false) &&
      // A configured resolver owns what the preview shows. Substituting samples
      // underneath it would mix invented values with real ones, and on the
      // failure path would contradict the note saying the *unresolved* template
      // is showing.
      !previewResolution?.isConfigured,
  ),
);

const canUseAiChat = computed(
  () =>
    (caps.plan?.hasFeature("ai_generation") ?? false) &&
    (caps.ai?.isFeatureEnabled("chat") ?? false),
);
const canUseDesignToTemplate = computed(
  () =>
    (caps.plan?.hasFeature("ai_generation") ?? false) &&
    (caps.ai?.isFeatureEnabled("designToTemplate") ?? false),
);

/**
 * Whether the hand-toggled display-condition filter applies here. Owned by
 * `useEditorCore` and injected rather than re-derived — see the key's comment.
 */
const appliesConditionFilter = inject(APPLIES_CONDITION_FILTER_KEY, null);

const blocks = computed({
  get: () => props.content.blocks,
  set: (value: Block[]) => {
    editor.setContent({
      ...props.content,
      blocks: value,
    });
  },
});

// Shared with the preview canvas and the save dialog's scaled rows, so all
// three lay out against the same width.
const viewportWidth = computed(() =>
  getEmailFrameWidth(props.content.settings, props.viewport),
);

// Email-background band shown on each side of the content column. The editor
// canvas is sized to the email's content width, so without this there are no
// gutters for the global background to occupy — a full-width section's own
// background hides it entirely (#230). A fixed band (rather than filling the
// work area) keeps the gutters from overwhelming the content on wide monitors
// and never collapses below the content width on narrow ones, while the
// neutral work area beyond the stage is preserved so editor chrome stays
// legible.
const CANVAS_GUTTER = 96;

// The "stage" represents the email body: the content column plus a gutter of
// email background on each side. Mirrors how `mj-body background-color`
// renders in the gutters around the centered content when the email is sent.
const stageWidth = computed(() => viewportWidth.value + CANVAS_GUTTER * 2);

// Canvas dark mode preview: simulates how the email will appear in recipients'
// dark-themed email clients. Uses CSS filter inversion — independent of the
// editor UI theme (light/dark/auto) which is controlled via uiTheme config.
// The email bg lives on the `.tpl-canvas-bg` sibling layer (so it can be
// inverted by `filter` without trapping block chrome in a stacking context);
// the `.tpl-canvas` itself stays transparent so the bg layer shows through.
// Shared with every other surface that renders blocks (the saved-block
// previews), so a block looks the same wherever it is drawn.
const canvasStyle = computed(() => getDocumentStyle(props.content.settings));

// Empty canvas: the whole dashed placeholder IS the Sortable drop zone.
// `isEmptyCanvas` toggles the styling + the inline empty-state content.
const isEmptyCanvas = computed(
  () => blocks.value.length === 0 && !props.previewMode,
);

// Highlight the empty drop zone while a block is being dragged over it.
// Uses a counter to handle dragenter/leave bubbling from descendants —
// raw event toggling would flicker as the pointer moves between children.
const dragEnterDepth = ref(0);
const isDragOverEmpty = computed(
  () => isEmptyCanvas.value && dragEnterDepth.value > 0,
);

function handleEmptyDragEnter(): void {
  if (!isEmptyCanvas.value) return;
  dragEnterDepth.value += 1;
}

function handleEmptyDragLeave(): void {
  if (!isEmptyCanvas.value) return;
  dragEnterDepth.value = Math.max(0, dragEnterDepth.value - 1);
}

function handleEmptyDrop(): void {
  dragEnterDepth.value = 0;
}

function handleCanvasClick(event: MouseEvent): void {
  if (props.previewMode) {
    return;
  }
  // During a pick session, a stray background click must not clear anything —
  // the session is left only via the bar's Save/Cancel or Escape. Deselecting
  // here would also be meaningless, since picking doesn't touch selection.
  if (caps.savedBlocks?.isPicking.value) {
    return;
  }
  if (event.target === event.currentTarget) {
    emit("select-block", null);
  }
}

function getBlockComponent(block: Block): Component | null {
  return resolveBlockComponent(block, blockRegistry, blockComponentMap);
}

function getBlockLock(blockId: string): Collaborator | null {
  return props.lockedBlocks?.get(blockId) ?? null;
}

/**
 * A click on a block either toggles its pick (while a saved-blocks pick
 * session is running) or selects it. Preview mode and collaborator locks are
 * checked first, so a locked block can be neither selected nor picked.
 */
function handleBlockSelect(blockId: string): void {
  if (props.previewMode || getBlockLock(blockId)) return;
  const savedBlocks = caps.savedBlocks;
  if (savedBlocks?.isPicking.value) {
    savedBlocks.togglePick(blockId);
    return;
  }
  emit("select-block", blockId);
}

function isPickedBlock(blockId: string): boolean {
  return caps.savedBlocks?.isPicked(blockId) ?? false;
}

/** True while a pick session runs — swaps block chrome into picking behaviour. */
const isPicking = computed(() => caps.savedBlocks?.isPicking.value === true);

function handleFetchData(
  block: Block,
  payload: {
    fieldValues: Record<string, unknown>;
    dataSourceFetched: boolean;
  },
): void {
  if (block.type !== "custom") {
    return;
  }

  editor.updateBlock(block.id, {
    fieldValues: payload.fieldValues,
    dataSourceFetched: payload.dataSourceFetched,
  } as Partial<CustomBlockType>);
}
</script>

<template>
  <!-- STAGE — the email body. Sized to the content column plus a gutter of
       email background on each side, so the global background stays visible
       around full-width sections, mirroring how `mj-body background-color`
       renders in the gutters when sent (#230). The neutral work area beyond
       the stage is preserved so the canvas still reads as a floating card and
       editor chrome stays legible. -->
  <div
    class="tpl-canvas-stage tpl:relative tpl:flex tpl:justify-center tpl:rounded-lg"
    :style="{
      width: `${stageWidth}px`,
      boxShadow: darkMode ? 'none' : 'var(--tpl-shadow-xl)',
      transition: EMAIL_FRAME_WIDTH_TRANSITION,
    }"
  >
    <!-- Background layer — holds the email bg and the dark-preview filter,
         spanning the full stage (content + gutters). Filter on this leaf
         layer (no descendants) does not create a containing block / stacking
         context that would trap block chrome (action bar, indicators) inside
         the wrapper. The filter has its own transition so the canvas fades
         smoothly between modes. -->
    <div
      class="tpl-canvas-bg tpl:absolute tpl:inset-0 tpl:rounded-lg tpl:pointer-events-none"
      :style="{
        backgroundColor: content.settings.backgroundColor,
        ...(darkMode ? { filter: 'invert(1) hue-rotate(180deg)' } : {}),
        transition: 'filter 300ms ease',
      }"
    />
    <!-- CONTENT COLUMN — the email content at its true width, centered in the
         stage. A full-width section fills this column but not the surrounding
         gutters, so the global background remains visible beside it. -->
    <div
      data-testid="canvas-wrapper"
      role="region"
      :aria-label="t.landmarks.canvas"
      class="tpl-canvas-wrapper tpl:relative"
      :style="{
        width: `${viewportWidth}px`,
        transition: EMAIL_FRAME_WIDTH_TRANSITION,
      }"
    >
      <div
        class="tpl-canvas tpl:relative tpl:rounded-lg"
        :class="{
          'tpl-canvas--dark-mode': darkMode,
          'tpl-preview-mode': previewMode,
        }"
        :style="canvasStyle"
        @click="handleCanvasClick"
      >
        <!-- Preview resolution. The skeleton shows only on a *first* resolve —
             `isInitialResolve` — so switching recipient or reopening keeps the
             last good preview on screen instead of flashing over it. -->
        <div
          v-if="previewResolution?.isInitialResolve.value"
          role="status"
          aria-busy="true"
          data-testid="preview-resolution-loading"
          class="tpl:flex tpl:flex-col tpl:gap-3 tpl:p-6"
        >
          <span class="tpl:sr-only">{{ t.previewResolution.resolving }}</span>
          <div
            v-for="n in 3"
            :key="n"
            aria-hidden="true"
            class="tpl-pulse tpl:h-16 tpl:rounded-md tpl:bg-[var(--tpl-bg-hover)]"
          ></div>
        </div>

        <!-- Resolution failed: the unresolved template still renders below, so
             the preview degrades rather than disappearing. -->
        <p
          v-else-if="previewResolution?.hasFailed.value"
          role="status"
          data-testid="preview-resolution-failed"
          class="tpl:mx-6 tpl:mt-4 tpl:rounded-md tpl:px-3 tpl:py-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)] tpl:bg-[var(--tpl-bg-hover)]"
        >
          {{ t.previewResolution.failed }}
        </p>

        <VueDraggable
          v-show="!previewResolution?.isInitialResolve.value"
          v-model="blocks"
          group="blocks"
          :animation="150"
          ghost-class="tpl-ghost"
          drag-class="tpl-dragging"
          handle=".tpl-block-btn"
          :invert-swap="true"
          :inverted-swap-threshold="0.65"
          :disabled="previewMode"
          :draggable="'.tpl-block-item'"
          :force-fallback="true"
          :class="[
            'tpl-canvas-blocks',
            isEmptyCanvas
              ? 'tpl-canvas-empty tpl:m-6 tpl:flex tpl:min-h-[400px] tpl:flex-col tpl:items-center tpl:justify-center tpl:rounded-xl tpl:border-2 tpl:border-dashed tpl:px-10 tpl:py-12 tpl:text-center tpl:bg-[var(--tpl-bg-elevated)] tpl:font-[var(--tpl-font-family)] tpl:transition-colors tpl:duration-150'
              : '',
            isEmptyCanvas && isDragOverEmpty
              ? 'tpl-canvas-empty--drag-over tpl:border-[var(--tpl-primary-hover)] tpl:bg-[var(--tpl-primary-light)]'
              : '',
            isEmptyCanvas && !isDragOverEmpty
              ? 'tpl:border-[var(--tpl-primary)]'
              : '',
          ]"
          @dragenter="handleEmptyDragEnter"
          @dragleave="handleEmptyDragLeave"
          @drop="handleEmptyDrop"
        >
          <!-- Empty-state content: rendered INSIDE the draggable so the whole
             dashed box is the drop zone, but excluded from sortable items via
             the `:draggable="'.tpl-block-item'"` selector above — only
             `.tpl-block-item` children are sortable, this isn't. -->
          <div
            v-if="isEmptyCanvas"
            class="tpl-canvas-empty-content tpl:flex tpl:flex-col tpl:items-center"
          >
            <div
              class="tpl-canvas-empty-icon tpl:mb-4 tpl:text-[var(--tpl-primary)]"
            >
              <SquarePlus :size="48" :stroke-width="1" />
            </div>
            <p
              class="tpl-canvas-empty-title tpl:m-0 tpl:mb-2 tpl:text-base tpl:font-semibold tpl:text-[var(--tpl-primary)]"
            >
              {{ t.canvas.noBlocks }}
            </p>
            <p
              class="tpl-canvas-empty-text tpl:m-0 tpl:text-sm tpl:text-[var(--tpl-text-dim)]"
            >
              {{ t.canvas.dragHint }}
            </p>
            <p
              v-if="canUseAiChat && cloudT"
              class="tpl:m-0 tpl:mt-2 tpl:flex tpl:flex-wrap tpl:items-center tpl:justify-center tpl:gap-x-1 tpl:gap-y-0.5 tpl:text-sm tpl:text-[var(--tpl-text-dim)]"
            >
              {{ t.canvas.aiHintChat }}
              <button
                class="tpl:inline-flex tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:gap-1 tpl:whitespace-nowrap tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-2 tpl:py-0.5 tpl:text-sm tpl:font-semibold tpl:transition-colors tpl:duration-150 tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary-hover)]"
                @click="emit('open-ai-chat')"
              >
                <Sparkles :size="14" :stroke-width="2" />
                {{ cloudT.aiMenu.aiAssistant }}
              </button>
              {{ t.canvas.aiHintChatSuffix }}
            </p>
            <p
              v-if="canUseDesignToTemplate && cloudT"
              class="tpl:m-0 tpl:mt-4 tpl:flex tpl:flex-wrap tpl:items-center tpl:justify-center tpl:gap-x-1 tpl:gap-y-0.5 tpl:text-sm tpl:text-[var(--tpl-text-dim)]"
            >
              {{ t.canvas.aiHintDesign }}
              <button
                class="tpl:inline-flex tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:gap-1 tpl:whitespace-nowrap tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-2 tpl:py-0.5 tpl:text-sm tpl:font-semibold tpl:transition-colors tpl:duration-150 tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary-hover)]"
                @click="emit('open-design-reference')"
              >
                <ImageUp :size="14" :stroke-width="2" />
                {{ cloudT.aiMenu.designToTemplate }}
              </button>
              {{ t.canvas.aiHintDesignSuffix }}
            </p>
          </div>
          <div
            v-for="block in blocks"
            :key="block.id"
            class="tpl-block-item"
            v-show="
              appliesConditionFilter === false ||
              !conditionPreview?.isHidden(block.id)
            "
          >
            <div class="tpl:relative">
              <!-- Collaboration lock overlay -->
              <div
                v-if="getBlockLock(block.id)"
                class="tpl-collab-lock tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-[4] tpl:rounded-sm"
                :style="{
                  outline: `2px solid ${getBlockLock(block.id)!.color}`,
                  outlineOffset: '-1px',
                }"
              >
                <span
                  class="tpl:absolute tpl:-top-0.5 tpl:left-1/2 tpl:z-[5] tpl:flex tpl:-translate-x-1/2 tpl:-translate-y-full tpl:items-center tpl:gap-1 tpl:rounded-full tpl:px-2 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:whitespace-nowrap"
                  :style="{
                    backgroundColor: getBlockLock(block.id)!.color,
                    color: readableTextColor(getBlockLock(block.id)!.color),
                  }"
                >
                  <span
                    class="tpl:inline-flex tpl:size-3 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-[8px] tpl:font-bold"
                    style="
                      background-color: color-mix(
                        in srgb,
                        var(--tpl-bg) 30%,
                        transparent
                      );
                    "
                  >
                    {{ getBlockLock(block.id)!.name.charAt(0) }}
                  </span>
                  {{ getBlockLock(block.id)!.name }}
                </span>
              </div>
              <BlockWrapper
                :block="block"
                :is-selected="
                  !previewMode &&
                  !isPicking &&
                  selectedBlockId === block.id &&
                  !getBlockLock(block.id)
                "
                :picked="isPickedBlock(block.id)"
                :viewport="viewport"
                :preview-mode="previewMode"
                @select="handleBlockSelect(block.id)"
              >
                <component
                  :is="getBlockComponent(block)"
                  :block="block"
                  :viewport="viewport"
                  @fetch-data="handleFetchData(block, $event)"
                  @update="
                    (updates: Partial<Block>) =>
                      editor.updateBlock(block.id, updates)
                  "
                />
              </BlockWrapper>
            </div>
          </div>
        </VueDraggable>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Dark-mode preview: invert only top-level `.tpl-block-content`. Applying
   filter to every `.tpl-block-content` would compound at nested levels
   (sections wrapping child blocks) and cancel out — `:not(...)` restricts
   it to outermost wrappers so the inversion is single-pass. Block chrome
   (action bar, indicators, overlays) lives outside `.tpl-block-content`
   and is therefore never filtered — no counter-filter / toggle flicker. */
.tpl-canvas--dark-mode :deep(.tpl-block-content:not(.tpl-block-content *)) {
  filter: invert(1) hue-rotate(180deg);
}
:deep(.tpl-block-content) {
  transition: filter 300ms ease;
}

/* Counter-invert images so they look normal inside the inverted block
   content layer (canonical CSS-filter dark-mode trick). */
.tpl-canvas--dark-mode :deep(.tpl-block-content img) {
  filter: invert(1) hue-rotate(180deg);
}
</style>
