<script setup lang="ts">
import ButtonBlock from "./blocks/ButtonBlock.vue";
import CustomBlock from "./blocks/CustomBlock.vue";
import DividerBlock from "./blocks/DividerBlock.vue";
import HtmlBlock from "./blocks/HtmlBlock.vue";
import ImageBlock from "./blocks/ImageBlock.vue";
import MenuBlock from "./blocks/MenuBlock.vue";
import PreviewSectionBlock from "./blocks/PreviewSectionBlock.vue";
import SocialIconsBlock from "./blocks/SocialIconsBlock.vue";
import SpacerBlock from "./blocks/SpacerBlock.vue";
import TableBlock from "./blocks/TableBlock.vue";
import TitleBlock from "./blocks/TitleBlock.vue";
import ParagraphBlock from "./blocks/ParagraphBlock.vue";
import VideoBlock from "./blocks/VideoBlock.vue";
import {
  BLOCK_REGISTRY_KEY,
  CONDITION_PREVIEW_KEY,
  EDITOR_KEY,
  MERGE_TAG_SAMPLE_MODE_KEY,
  USE_MERGE_TAG_SAMPLES_KEY,
} from "../keys";
import {
  resolveBlockComponent,
  getBlockWrapperStyle,
  getDocumentStyle,
} from "../utils/blockComponentResolver";
import {
  EMAIL_FRAME_WIDTH_TRANSITION,
  getEmailFrameWidth,
} from "../utils/emailFrameWidth";
import type { Block, ViewportSize } from "@templatical/types";
import { computed, inject, provide, type Component } from "vue";

const props = withDefaults(
  defineProps<{
    blocks: Block[];
    /**
     * Which viewport to render. Defaults to `desktop`, so the saved-blocks
     * surfaces — which have no viewport control — behave exactly as before.
     * The test-email dialog passes the user's choice so responsive blocks show
     * the variant a recipient on that device would receive.
     */
    viewport?: ViewportSize;
  }>(),
  { viewport: "desktop" },
);

const blockRegistry = inject(BLOCK_REGISTRY_KEY);
const editor = inject(EDITOR_KEY, null);
const conditionPreview = inject(CONDITION_PREVIEW_KEY, null);

/**
 * This canvas is only ever a preview — nothing here is editable — so it honours
 * the user's mode directly, with no `previewMode` gate of the kind `Canvas.vue`
 * needs. Re-provided rather than left to inherit, because a `BlockPreviewCanvas`
 * inside a dialog may sit under an editing `Canvas` that provides `false`.
 */
const mergeTagSampleMode = inject(MERGE_TAG_SAMPLE_MODE_KEY, null);
provide(
  USE_MERGE_TAG_SAMPLES_KEY,
  computed(() => mergeTagSampleMode?.value ?? false),
);

/**
 * Blocks a display condition currently excludes, so a preview never shows
 * content the recipient won't get. The canvas does the same via
 * `v-show="!conditionPreview?.isHidden(block.id)"`.
 *
 * A no-op for the saved-blocks browser: entries there carry their *stored* ids,
 * which aren't in the current template, so nothing is tracked as hidden. It
 * bites where it should — the save dialog and the test-email preview, both of
 * which show blocks that are live on the canvas.
 */
const visibleBlocks = computed(() =>
  props.blocks.filter((block) => !conditionPreview?.isHidden(block.id)),
);

/**
 * Frame width, from the one helper the canvas and the scaled preview rows also
 * use — so all three agree by construction rather than by three constants that
 * happen to match. A template with a custom body width now previews at that
 * width instead of a flat 600.
 */
const frameWidth = computed(() =>
  getEmailFrameWidth(editor?.content.value.settings, props.viewport),
);

/**
 * The same document-level style the canvas applies, so a previewed block
 * renders identically to the canvas one: without it the font falls back to the
 * editor UI's and the link rules hit their unset defaults, dropping the
 * underline and the link colour.
 *
 * Read from the *current* template even in the saved-blocks browser, where the
 * previewed content came from elsewhere — a saved block stores only `Block[]`,
 * and the current settings are what it will actually look like once inserted.
 */
const documentStyle = computed(() =>
  editor ? getDocumentStyle(editor.content.value.settings) : {},
);

const previewComponentMap: Record<string, Component> = {
  section: PreviewSectionBlock,
  title: TitleBlock,
  paragraph: ParagraphBlock,
  image: ImageBlock,
  video: VideoBlock,
  button: ButtonBlock,
  divider: DividerBlock,
  social: SocialIconsBlock,
  menu: MenuBlock,
  table: TableBlock,
  spacer: SpacerBlock,
  html: HtmlBlock,
  custom: CustomBlock,
};

function getBlockComponent(block: Block): Component | null {
  return resolveBlockComponent(block, blockRegistry, previewComponentMap);
}
</script>

<template>
  <div
    data-testid="block-preview-canvas"
    class="tpl:pointer-events-none tpl:mx-auto tpl:select-none tpl:rounded-lg"
    :style="{
      width: `${frameWidth}px`,
      transition: EMAIL_FRAME_WIDTH_TRANSITION,
      backgroundColor: 'var(--tpl-canvas-bg)',
      boxShadow: 'var(--tpl-shadow-sm)',
      ...documentStyle,
    }"
  >
    <div
      v-for="block in visibleBlocks"
      :key="block.id"
      :style="getBlockWrapperStyle(block)"
    >
      <component
        :is="getBlockComponent(block)"
        :block="block"
        :viewport="viewport"
      />
    </div>
  </div>
</template>
