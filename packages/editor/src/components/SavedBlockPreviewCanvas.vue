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
import { BLOCK_REGISTRY_KEY, EDITOR_KEY } from "../keys";
import {
  resolveBlockComponent,
  getBlockWrapperStyle,
  getDocumentStyle,
} from "../utils/blockComponentResolver";
import type { Block } from "@templatical/types";
import { computed, inject, type Component } from "vue";

defineProps<{
  blocks: Block[];
}>();

const blockRegistry = inject(BLOCK_REGISTRY_KEY);
const editor = inject(EDITOR_KEY, null);

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
    class="tpl:pointer-events-none tpl:mx-auto tpl:w-[600px] tpl:select-none tpl:rounded-lg"
    :style="{
      backgroundColor: 'var(--tpl-canvas-bg)',
      boxShadow: 'var(--tpl-shadow-sm)',
      ...documentStyle,
    }"
  >
    <div
      v-for="block in blocks"
      :key="block.id"
      :style="getBlockWrapperStyle(block)"
    >
      <component
        :is="getBlockComponent(block)"
        :block="block"
        viewport="desktop"
      />
    </div>
  </div>
</template>
