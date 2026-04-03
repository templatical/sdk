<script setup lang="ts">
import ButtonBlock from "./ButtonBlock.vue";
import CustomBlock from "./CustomBlock.vue";
import DividerBlock from "./DividerBlock.vue";
import HtmlBlock from "./HtmlBlock.vue";
import ImageBlock from "./ImageBlock.vue";
import MenuBlock from "./MenuBlock.vue";
import SocialIconsBlock from "./SocialIconsBlock.vue";
import SpacerBlock from "./SpacerBlock.vue";
import TableBlock from "./TableBlock.vue";
import TitleBlock from "./TitleBlock.vue";
import ParagraphBlock from "./ParagraphBlock.vue";
import VideoBlock from "./VideoBlock.vue";
import type { useBlockRegistry } from "../../composables";
import {
  resolveBlockComponent,
  getBlockWrapperStyle,
} from "../../utils/blockComponentResolver";
import type {
  Block,
  SectionBlock as SectionBlockType,
} from "@templatical/types";
import { computed, inject, type Component } from "vue";

const previewBlockComponentMap: Record<string, Component> = {
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

const props = defineProps<{
  block: SectionBlockType;
  viewport: "desktop";
}>();

defineOptions({ name: "PreviewSectionBlock" });

const blockRegistry =
  inject<ReturnType<typeof useBlockRegistry>>("blockRegistry");

const columnWidths = computed(() => {
  switch (props.block.columns) {
    case "2":
      return ["50%", "50%"];
    case "3":
      return ["33.33%", "33.33%", "33.33%"];
    case "1-2":
      return ["33.33%", "66.67%"];
    case "2-1":
      return ["66.67%", "33.33%"];
    default:
      return ["100%"];
  }
});

const columns = computed(() => {
  const count = columnWidths.value.length;
  const children = [...props.block.children];
  while (children.length < count) {
    children.push([]);
  }
  return children.slice(0, count);
});

function getColumnBlocks(colIndex: number): Block[] {
  return columns.value[colIndex] || [];
}

function getBlockComponent(block: Block): Component | null {
  return resolveBlockComponent(block, blockRegistry, previewBlockComponentMap);
}
</script>

<template>
  <div class="tpl:w-full">
    <div class="tpl:flex tpl:gap-0">
      <div
        v-for="(_, colIndex) in columns"
        :key="colIndex"
        :style="{ width: columnWidths[colIndex] }"
      >
        <div
          v-for="childBlock in getColumnBlocks(colIndex)"
          :key="childBlock.id"
          :style="getBlockWrapperStyle(childBlock)"
        >
          <!-- Recursive self-reference for nested sections -->
          <PreviewSectionBlock
            v-if="childBlock.type === 'section'"
            :block="childBlock"
            viewport="desktop"
          />
          <component
            :is="getBlockComponent(childBlock)"
            v-else
            :block="childBlock"
            viewport="desktop"
          />
        </div>
      </div>
    </div>
  </div>
</template>
