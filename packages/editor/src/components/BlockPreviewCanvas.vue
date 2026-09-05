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
  EMAIL_GUTTER,
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
    /**
     * Whether the hand-toggled display-condition filter still applies here.
     * `false` where a resolver owns the preview: it has already evaluated every
     * condition against real data, so layering a manual hide on top would veto
     * the answer that was asked for.
     *
     * A prop rather than an injected `PREVIEW_RESOLUTION_KEY` read, because the
     * test-email dialog builds its *own* resolution instance (keyed to the
     * selected recipient) — injecting would consult the shared canvas instance
     * and get the wrong answer.
     */
    applyConditionFilter?: boolean;
    /**
     * Drops the stage — its width, email background, rounded corners and shadow —
     * and lets the content column fill the caller instead of setting its own
     * width. For callers already inside an email frame: the canvas renders
     * `footerBlocks` this way, and with the stage the footer reads as a second
     * card floating inside the email rather than a continuation of it.
     */
    embedded?: boolean;
  }>(),
  { viewport: "desktop", applyConditionFilter: true, embedded: false },
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
 *
 * Skipped entirely when `applyConditionFilter` is false — see the prop.
 */
const visibleBlocks = computed(() =>
  props.applyConditionFilter
    ? props.blocks.filter((block) => !conditionPreview?.isHidden(block.id))
    : props.blocks,
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

/**
 * The email's body background — `mj-body background-color` when sent, and the
 * `.tpl-canvas-bg` layer on the editing canvas.
 *
 * Deliberately NOT part of `getDocumentStyle`: the canvas applies that helper
 * to `.tpl-canvas`, which must stay transparent so the invertible background
 * layer beneath it shows through. A background there would double-paint and
 * defeat the dark-mode preview.
 *
 * Truthiness, not `??`: the colour pickers clear to an empty string to mean
 * "unset", which as an inline style renders the frame transparent rather than
 * falling back to the neutral preview surface.
 */
const emailBackground = computed(
  () =>
    editor?.content.value.settings.backgroundColor || "var(--tpl-canvas-bg)",
);

/**
 * Width the stage asks for: the content column plus a full gutter on each side,
 * the same stage the canvas builds. It is an ask rather than a fixed size —
 * paired with `max-width: 100%` below, so a container with less room hands over
 * what it has and shows a narrower band instead of overflowing.
 *
 * It has to be a specified width, not `100%`: `TplModal`'s wrapper is
 * shrink-to-fit, so a percentage there resolves against a container whose size
 * the stage is itself supposed to influence, and the stage collapses to its
 * `min-width` — no gutters, on the one surface this exists for.
 */
const stageWidth = computed(() => frameWidth.value + EMAIL_GUTTER * 2);

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
  <!-- STAGE — the email body, holding the background and a gutter of it on
       each side of the content column, the same shape `Canvas.vue` builds.
       `max-width: 100%` is what makes it fit anywhere: a roomy surface shows
       the full band, a dialog shows as much as it has, and a container sized to
       the content column shows none. `min-width` keeps it from squeezing the
       column, so a cramped surface clips exactly as it did when the frame
       carried the width itself. -->
  <div
    data-testid="block-preview-stage"
    class="tpl:pointer-events-none tpl:select-none"
    :class="
      embedded
        ? undefined
        : 'tpl:mx-auto tpl:flex tpl:justify-center tpl:rounded-lg'
    "
    :style="
      embedded
        ? undefined
        : {
            width: `${stageWidth}px`,
            minWidth: `${frameWidth}px`,
            maxWidth: '100%',
            backgroundColor: emailBackground,
            boxShadow: 'var(--tpl-shadow-sm)',
          }
    "
  >
    <!-- CONTENT COLUMN — the blocks at their true email width. Keeps the
         testid: this is the element whose width *is* the email width, which is
         what every viewport assertion measures. -->
    <div
      data-testid="block-preview-canvas"
      :style="
        embedded
          ? documentStyle
          : {
              width: `${frameWidth}px`,
              transition: EMAIL_FRAME_WIDTH_TRANSITION,
              ...documentStyle,
            }
      "
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
  </div>
</template>
