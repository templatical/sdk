<script setup lang="ts">
import BlockWrapper from "./BlockWrapper.vue";
import ButtonBlock from "./ButtonBlock.vue";
import CustomBlock from "./CustomBlock.vue";
import DividerBlock from "./DividerBlock.vue";
import ImageBlock from "./ImageBlock.vue";
import TitleBlock from "./TitleBlock.vue";
import ParagraphBlock from "./ParagraphBlock.vue";
import { useI18n } from "../../composables";
import { resolveBlockComponent } from "../../utils/blockComponentResolver";
import type {
  Block,
  CustomBlock as CustomBlockType,
  SectionBlock as SectionBlockType,
  ViewportSize,
} from "@templatical/types";
import { computed, inject, type Component } from "vue";
import draggable from "vuedraggable";
import {
  EDITOR_KEY,
  CONDITION_PREVIEW_KEY,
  BLOCK_REGISTRY_KEY,
} from "../../keys";

const sectionBlockComponentMap: Record<string, Component> = {
  title: TitleBlock,
  paragraph: ParagraphBlock,
  image: ImageBlock,
  button: ButtonBlock,
  divider: DividerBlock,
  custom: CustomBlock,
};

const props = defineProps<{
  block: SectionBlockType;
  viewport: ViewportSize;
}>();

const { t } = useI18n();
const editor = inject(EDITOR_KEY)!;
const conditionPreview = inject(CONDITION_PREVIEW_KEY);
const blockRegistry = inject(BLOCK_REGISTRY_KEY);

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

function setColumnBlocks(colIndex: number, blocks: Block[]): void {
  const newChildren = [...props.block.children];
  while (newChildren.length <= colIndex) {
    newChildren.push([]);
  }
  newChildren[colIndex] = blocks;
  editor.updateBlock(props.block.id, { children: newChildren });
}

function getBlockComponent(block: Block): Component | null {
  return resolveBlockComponent(block, blockRegistry, sectionBlockComponentMap);
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
  <div class="tpl:w-full">
    <div class="tpl:flex tpl:gap-0">
      <div
        v-for="(_, colIndex) in columns"
        :key="colIndex"
        class="tpl:relative tpl:min-h-[60px] tpl:rounded"
        :class="
          getColumnBlocks(colIndex).length === 0
            ? 'tpl:border tpl:border-dashed tpl:border-[var(--tpl-border)]'
            : ''
        "
        :style="{ width: columnWidths[colIndex] }"
      >
        <draggable
          :model-value="getColumnBlocks(colIndex)"
          :group="{
            name: 'blocks',
            pull: true,
            put: (to: any, from: any, el: HTMLElement) =>
              el.dataset.blockType !== 'section',
          }"
          item-key="id"
          :animation="150"
          ghost-class="tpl-ghost"
          :empty-insert-threshold="20"
          class="tpl:min-h-[60px]"
          @update:model-value="(val: Block[]) => setColumnBlocks(colIndex, val)"
        >
          <template #item="{ element: childBlock }">
            <div v-show="!conditionPreview?.isHidden(childBlock.id)">
              <BlockWrapper
                :block="childBlock"
                :is-selected="editor.state.selectedBlockId === childBlock.id"
                :viewport="viewport"
                @select="editor.selectBlock(childBlock.id)"
              >
                <component
                  :is="getBlockComponent(childBlock)"
                  :block="childBlock"
                  :viewport="viewport"
                  @fetch-data="handleFetchData(childBlock, $event)"
                />
              </BlockWrapper>
            </div>
          </template>
        </draggable>
        <div
          v-if="getColumnBlocks(colIndex).length === 0"
          class="tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:flex tpl:items-center tpl:justify-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
        >
          <span>{{ t.section.dropHere }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
