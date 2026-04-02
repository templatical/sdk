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
import type { useBlockRegistry } from "../../composables";
import type { Block } from "@templatical/types";
import { inject, type Component } from "vue";

defineProps<{
  blocks: Block[];
}>();

const blockRegistry =
  inject<ReturnType<typeof useBlockRegistry>>("blockRegistry");

function getBlockComponent(block: Block): Component | null {
  if (blockRegistry) {
    const component = blockRegistry.getComponent(block);
    if (component) {
      return component;
    }
  }

  switch (block.type) {
    case "section":
      return PreviewSectionBlock;
    case "title":
      return TitleBlock;
    case "paragraph":
      return ParagraphBlock;
    case "image":
      return ImageBlock;
    case "video":
      return VideoBlock;
    case "button":
      return ButtonBlock;
    case "divider":
      return DividerBlock;
    case "social":
      return SocialIconsBlock;
    case "menu":
      return MenuBlock;
    case "table":
      return TableBlock;
    case "spacer":
      return SpacerBlock;
    case "html":
      return HtmlBlock;
    case "custom":
      return CustomBlock;
    default:
      return null;
  }
}

function getBlockWrapperStyle(block: Block): Record<string, string> {
  const { padding, margin, backgroundColor } = block.styles;
  return {
    padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
    margin: `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`,
    backgroundColor: backgroundColor || "transparent",
  };
}
</script>

<template>
  <div
    class="tpl:pointer-events-none tpl:mx-auto tpl:w-[600px] tpl:select-none tpl:rounded-lg tpl:bg-white"
    style="box-shadow: var(--tpl-shadow-sm)"
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
