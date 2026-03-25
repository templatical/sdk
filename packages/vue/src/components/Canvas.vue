<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import type {
  Block,
  Collaborator,
  CustomBlock as CustomBlockType,
  TemplateContent,
  ViewportSize,
} from "@templatical/types";
import type {
  UseEditorReturn,
  UseConditionPreviewReturn,
} from "@templatical/core";
import type { UseBlockRegistryReturn } from "../composables";
import { ImageUp, Sparkles, SquarePlus } from "lucide-vue-next";
import { computed, inject, type Component } from "vue";
import draggable from "vuedraggable";

import BlockWrapper from "./blocks/BlockWrapper.vue";
import SectionBlock from "./blocks/SectionBlock.vue";
import TextBlock from "./blocks/TextBlock.vue";
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

const editor = inject<UseEditorReturn>("editor")!;
const conditionPreview = inject<UseConditionPreviewReturn>("conditionPreview");
const blockRegistry = inject<UseBlockRegistryReturn>(
  "blockRegistry",
  undefined as unknown as UseBlockRegistryReturn,
);

// Cloud-only injects — null in OSS mode
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const planConfig = inject<any>("planConfig", null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const aiConfig = inject<any>("aiConfig", null);

const canUseAi = computed(
  () => planConfig?.hasFeature("ai_generation") ?? false,
);
const canUseAiChat = computed(
  () => canUseAi.value && aiConfig?.isFeatureEnabled("chat"),
);
const canUseDesignToTemplate = computed(
  () => canUseAi.value && aiConfig?.isFeatureEnabled("designToTemplate"),
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

const canvasStyle = computed(() => ({
  backgroundColor: props.content.settings.backgroundColor,
  fontFamily: props.content.settings.fontFamily,
  filter: props.darkMode ? "invert(1) hue-rotate(180deg)" : "none",
  transition: "filter 300ms ease",
}));

function handleCanvasClick(event: MouseEvent): void {
  if (props.previewMode) {
    return;
  }
  if (event.target === event.currentTarget) {
    emit("select-block", null);
  }
}

function getBlockComponent(block: Block): Component | null {
  if (blockRegistry) {
    const component = blockRegistry.getComponent(block);
    if (component) {
      return component;
    }
  }

  switch (block.type) {
    case "section":
      return SectionBlock;
    case "text":
      return TextBlock;
    case "image":
      return ImageBlock;
    case "button":
      return ButtonBlock;
    case "divider":
      return DividerBlock;
    case "spacer":
      return SpacerBlock;
    case "html":
      return HtmlBlock;
    case "social":
      return SocialIconsBlock;
    case "menu":
      return MenuBlock;
    case "table":
      return TableBlock;
    case "video":
      return VideoBlock;
    case "custom":
      return CustomBlock;
    default:
      return null;
  }
}

function getBlockLockHolder(blockId: string): Collaborator | undefined {
  return props.lockedBlocks?.get(blockId);
}

function isBlockLocked(blockId: string): boolean {
  return props.lockedBlocks?.has(blockId) ?? false;
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
    class="tpl-canvas-wrapper tpl:rounded-lg tpl:bg-white tpl:transition-[width] tpl:duration-300"
    style="
      box-shadow: var(--tpl-shadow-xl);
      transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
    "
    :style="{ width: `${viewportWidth}px` }"
  >
    <div
      class="tpl-canvas tpl:min-h-[500px] tpl:rounded-lg"
      :class="{
        'tpl-canvas--dark-mode': darkMode,
        'tpl-preview-mode': previewMode,
      }"
      :style="canvasStyle"
      @click="handleCanvasClick"
    >
      <draggable
        v-model="blocks"
        group="blocks"
        item-key="id"
        :animation="150"
        ghost-class="tpl-ghost"
        drag-class="tpl-dragging"
        handle=".tpl-block-btn"
        :invert-swap="true"
        :inverted-swap-threshold="0.65"
        :disabled="previewMode"
        class="tpl-canvas-blocks tpl:min-h-[500px]"
      >
        <template #item="{ element: block }">
          <div v-show="!conditionPreview?.isHidden(block.id)">
            <div class="tpl:relative">
              <!-- Collaboration lock overlay -->
              <div
                v-if="isBlockLocked(block.id)"
                class="tpl-collab-lock tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-[4] tpl:rounded-sm"
                :style="{
                  outline: `2px solid ${getBlockLockHolder(block.id)!.color}`,
                  outlineOffset: '-1px',
                }"
              >
                <span
                  class="tpl:absolute tpl:-top-0.5 tpl:left-1/2 tpl:z-[5] tpl:flex tpl:-translate-x-1/2 tpl:-translate-y-full tpl:items-center tpl:gap-1 tpl:rounded-full tpl:px-2 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:text-white tpl:whitespace-nowrap"
                  :style="{
                    backgroundColor: getBlockLockHolder(block.id)!.color,
                  }"
                >
                  <span
                    class="tpl:inline-flex tpl:size-3 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-[8px] tpl:font-bold"
                    style="background-color: rgba(255, 255, 255, 0.3)"
                  >
                    {{ getBlockLockHolder(block.id)!.name.charAt(0) }}
                  </span>
                  {{ getBlockLockHolder(block.id)!.name }}
                </span>
              </div>
              <BlockWrapper
                :block="block"
                :is-selected="
                  !previewMode &&
                  selectedBlockId === block.id &&
                  !isBlockLocked(block.id)
                "
                :viewport="viewport"
                :preview-mode="previewMode"
                @select="
                  previewMode || isBlockLocked(block.id)
                    ? undefined
                    : emit('select-block', block.id)
                "
              >
                <component
                  :is="getBlockComponent(block)"
                  :block="block"
                  :viewport="viewport"
                  @fetch-data="handleFetchData(block, $event)"
                  @update="(updates: Partial<Block>) => editor.updateBlock(block.id, updates)"
                />
              </BlockWrapper>
            </div>
          </div>
        </template>
        <template #footer>
          <div
            v-if="blocks.length === 0 && !previewMode"
            class="tpl-canvas-empty tpl:m-6 tpl:flex tpl:min-h-[400px] tpl:flex-col tpl:items-center tpl:justify-center tpl:rounded-xl tpl:border-2 tpl:border-dashed tpl:px-10 tpl:py-12 tpl:text-center"
            style="
              border-color: var(--tpl-border-light);
              background-color: var(--tpl-bg-elevated);
              font-family: var(--tpl-font-family);
            "
          >
            <div
              class="tpl-canvas-empty-icon tpl:mb-4"
              style="color: var(--tpl-border-light)"
            >
              <SquarePlus :size="48" :stroke-width="1" />
            </div>
            <p
              class="tpl-canvas-empty-title tpl:m-0 tpl:mb-2 tpl:text-base tpl:font-semibold"
              style="color: var(--tpl-text-muted)"
            >
              {{ t.canvas.noBlocks }}
            </p>
            <p
              class="tpl-canvas-empty-text tpl:m-0 tpl:text-sm"
              style="color: var(--tpl-text-dim)"
            >
              {{ t.canvas.dragHint }}
            </p>
            <p
              v-if="canUseAiChat"
              class="tpl:m-0 tpl:mt-2 tpl:flex tpl:flex-wrap tpl:items-center tpl:justify-center tpl:gap-x-1 tpl:gap-y-0.5 tpl:text-sm"
              style="color: var(--tpl-text-dim)"
            >
              {{ t.canvas.aiHintChat }}
              <button
                class="tpl:inline-flex tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:gap-1 tpl:whitespace-nowrap tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-2 tpl:py-0.5 tpl:text-sm tpl:font-semibold tpl:transition-colors tpl:duration-150"
                style="
                  background-color: var(--tpl-primary-light);
                  color: var(--tpl-primary-hover);
                "
                @click="emit('open-ai-chat')"
              >
                <Sparkles :size="14" :stroke-width="2" />
                {{ t.aiMenu.aiAssistant }}
              </button>
              {{ t.canvas.aiHintChatSuffix }}
            </p>
            <p
              v-if="canUseDesignToTemplate"
              class="tpl:m-0 tpl:mt-4 tpl:flex tpl:flex-wrap tpl:items-center tpl:justify-center tpl:gap-x-1 tpl:gap-y-0.5 tpl:text-sm"
              style="color: var(--tpl-text-dim)"
            >
              {{ t.canvas.aiHintDesign }}
              <button
                class="tpl:inline-flex tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:gap-1 tpl:whitespace-nowrap tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-2 tpl:py-0.5 tpl:text-sm tpl:font-semibold tpl:transition-colors tpl:duration-150"
                style="
                  background-color: var(--tpl-primary-light);
                  color: var(--tpl-primary-hover);
                "
                @click="emit('open-design-reference')"
              >
                <ImageUp :size="14" :stroke-width="2" />
                {{ t.aiMenu.designToTemplate }}
              </button>
              {{ t.canvas.aiHintDesignSuffix }}
            </p>
          </div>
        </template>
      </draggable>
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
