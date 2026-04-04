<script setup lang="ts">
import ButtonBlock from "../../components/blocks/ButtonBlock.vue";
import CustomBlock from "../../components/blocks/CustomBlock.vue";
import DividerBlock from "../../components/blocks/DividerBlock.vue";
import HtmlBlock from "../../components/blocks/HtmlBlock.vue";
import ImageBlock from "../../components/blocks/ImageBlock.vue";
import MenuBlock from "../../components/blocks/MenuBlock.vue";
import PreviewSectionBlock from "../../components/blocks/PreviewSectionBlock.vue";
import SocialIconsBlock from "../../components/blocks/SocialIconsBlock.vue";
import SpacerBlock from "../../components/blocks/SpacerBlock.vue";
import TableBlock from "../../components/blocks/TableBlock.vue";
import TitleBlock from "../../components/blocks/TitleBlock.vue";
import ParagraphBlock from "../../components/blocks/ParagraphBlock.vue";
import VideoBlock from "../../components/blocks/VideoBlock.vue";
import type { UseBlockRegistryReturn } from "../../composables";
import {
  resolveBlockComponent,
  getBlockWrapperStyle,
} from "../../utils/blockComponentResolver";
import type { Block } from "@templatical/types";
import { inject, type Component } from "vue";

defineProps<{
  blocks: Block[];
}>();

const blockRegistry = inject<UseBlockRegistryReturn>("blockRegistry");

const modulePreviewComponentMap: Record<string, Component> = {
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
  return resolveBlockComponent(block, blockRegistry, modulePreviewComponentMap);
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
