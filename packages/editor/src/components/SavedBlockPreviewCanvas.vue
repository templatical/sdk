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
import { BLOCK_REGISTRY_KEY } from "../keys";
import {
  resolveBlockComponent,
  getBlockWrapperStyle,
} from "../utils/blockComponentResolver";
import type { Block } from "@templatical/types";
import { inject, type Component } from "vue";

defineProps<{
  blocks: Block[];
}>();

const blockRegistry = inject(BLOCK_REGISTRY_KEY);

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
    style="
      background-color: var(--tpl-canvas-bg);
      box-shadow: var(--tpl-shadow-sm);
    "
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
