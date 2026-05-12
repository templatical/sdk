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
import { computed, inject, ref, type Component } from "vue";
import {
  EDITOR_KEY,
  CONDITION_PREVIEW_KEY,
  BLOCK_REGISTRY_KEY,
  CAPABILITIES_KEY,
  requireInject,
} from "../keys";
import { VueDraggable } from "vue-draggable-plus";
import { resolveBlockComponent } from "../utils/blockComponentResolver";
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
import CountdownBlockComponent from "./blocks/CountdownBlock.vue";

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
  countdown: CountdownBlockComponent,
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

const blocks = computed({
  get: () => props.content.blocks,
  set: (value: Block[]) => {
    editor.setContent({
      ...props.content,
      blocks: value,
    });
  },
});

const viewportWidth = computed(() => {
  switch (props.viewport) {
    case "mobile":
      return 375;
    case "tablet":
      return 768;
    default:
      return props.content.settings.width;
  }
});

// Canvas dark mode preview: simulates how the email will appear in recipients'
// dark-themed email clients. Uses CSS filter inversion — independent of the
// editor UI theme (light/dark/auto) which is controlled via uiTheme config.
const canvasStyle = computed(() => ({
  backgroundColor: props.content.settings.backgroundColor,
  fontFamily: props.content.settings.fontFamily,
}));

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
  <div
    data-testid="canvas-wrapper"
    role="region"
    :aria-label="t.landmarks.canvas"
    class="tpl-canvas-wrapper tpl:rounded-lg"
    :style="{
      width: `${viewportWidth}px`,
      backgroundColor: content.settings.backgroundColor,
      boxShadow: darkMode ? 'none' : 'var(--tpl-shadow-xl)',
      filter: darkMode ? 'invert(1) hue-rotate(180deg)' : 'none',
      transition:
        'width 300ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 300ms ease',
    }"
  >
    <div
      class="tpl-canvas tpl:rounded-lg"
      :class="{
        'tpl-canvas--dark-mode': darkMode,
        'tpl-preview-mode': previewMode,
      }"
      :style="canvasStyle"
      @click="handleCanvasClick"
    >
      <VueDraggable
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
          v-show="!conditionPreview?.isHidden(block.id)"
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
                selectedBlockId === block.id &&
                !getBlockLock(block.id)
              "
              :viewport="viewport"
              :preview-mode="previewMode"
              @select="
                previewMode || getBlockLock(block.id)
                  ? undefined
                  : emit('select-block', block.id)
              "
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
</template>

<style scoped>
/* Counter-invert images so they look normal in dark mode */
.tpl-canvas--dark-mode :deep(img) {
  filter: invert(1) hue-rotate(180deg);
}

/* Counter-invert editor UI chrome so controls stay readable */
.tpl-canvas--dark-mode :deep(.tpl-block-actions),
.tpl-canvas--dark-mode :deep(.tpl-condition-toggle),
.tpl-canvas--dark-mode :deep(.tpl-block-hidden-overlay) {
  filter: invert(1) hue-rotate(180deg);
}
</style>
