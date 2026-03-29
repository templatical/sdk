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
import TextBlock from "./TextBlock.vue";
import VideoBlock from "./VideoBlock.vue";
import type { useBlockRegistry } from "../../composables";
import type {
  Block,
  SectionBlock as SectionBlockType,
} from "@templatical/types";
import { computed, inject, type Component } from "vue";

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
  if (blockRegistry) {
    const component = blockRegistry.getComponent(block);
    if (component) {
      return component;
    }
  }

  switch (block.type) {
    case "text":
      return TextBlock;
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
