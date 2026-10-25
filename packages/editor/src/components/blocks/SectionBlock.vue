<script setup lang="ts">
import { updateBlockList } from "../../utils/updateBlockList";
import { useLocalizedDisplay } from "../../composables/useLocalizedDisplay";
import BlockWrapper from "./BlockWrapper.vue";
import ButtonBlock from "./ButtonBlock.vue";
import CustomBlock from "./CustomBlock.vue";
import DividerBlock from "./DividerBlock.vue";
import ImageBlock from "./ImageBlock.vue";
import TitleBlock from "./TitleBlock.vue";
import ParagraphBlock from "./ParagraphBlock.vue";
import { useI18n } from "../../composables";
import { resolveBlockComponent } from "../../utils/blockComponentResolver";
import { canDropInSectionColumn } from "../../utils/sectionColumnDrop";
import { resolveHero } from "@templatical/types";
import type {
  Block,
  CustomBlock as CustomBlockType,
  SectionBlock as SectionBlockType,
  ViewportSize,
} from "@templatical/types";
import { computed, inject, ref, type Component } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import {
  EDITOR_KEY,
  APPLIES_CONDITION_FILTER_KEY,
  CONDITION_PREVIEW_KEY,
  BLOCK_REGISTRY_KEY,
  CAPABILITIES_KEY,
  requireInject,
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
const editor = requireInject(EDITOR_KEY, "SectionBlock");
const { displayBlock } = useLocalizedDisplay(editor);
const baseBlock = computed(
  () =>
    editor.content.value.blocks.find(
      (block) => block.id === props.block.id && block.type === "section",
    ) as SectionBlockType | undefined,
);
const conditionPreview = inject(CONDITION_PREVIEW_KEY, null);
const blockRegistry = inject(BLOCK_REGISTRY_KEY, null);
const caps = inject(CAPABILITIES_KEY, {});
// Provided by the surface, never re-derived here — see the key's comment.
const appliesConditionFilter = inject(APPLIES_CONDITION_FILTER_KEY, null);

/**
 * A click on a column child either picks the whole section (during a
 * saved-blocks pick session) or selects the child.
 *
 * Section children are never independently savable — a saved block's content is
 * a top-level `Block[]` — so the section is what a click resolves to. This has
 * to be explicit: `BlockWrapper.handleClick` calls `stopPropagation()`, so the
 * click never reaches the section's own wrapper on its own.
 */
function handleChildSelect(childBlockId: string): void {
  const savedBlocks = caps.savedBlocks;
  if (savedBlocks?.isPicking.value) {
    savedBlocks.togglePick(props.block.id);
    return;
  }
  editor.selectBlock(childBlockId);
}

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
  const children = [
    ...(editor.state.previewMode
      ? props.block
      : (baseBlock.value ?? props.block)
    ).children,
  ];
  while (children.length < count) {
    children.push([]);
  }
  return children.slice(0, count);
});

// Mirror MJML's responsive behavior in the canvas: on the mobile viewport,
// columns stack full-width unless the section opts out via `stackOnMobile:
// false` (which renders as `<mj-group>` and keeps them side-by-side).
const isMobileStacked = computed(
  () => props.viewport === "mobile" && props.block.stackOnMobile !== false,
);

function getColumnBlocks(colIndex: number): Block[] {
  return columns.value[colIndex] || [];
}

function isChildShown(blockId: string): boolean {
  return (
    appliesConditionFilter?.value === false ||
    !conditionPreview?.isHidden(blockId)
  );
}

// A column showing no blocks keeps a drop target's height. One showing blocks
// is exactly as tall as they are, as it will be in the sent email.
function showsNoBlocks(colIndex: number): boolean {
  return !getColumnBlocks(colIndex).some((child) => isChildShown(child.id));
}

// The column a drag started from keeps its drop height for the whole drag of
// its last shown block, so it doesn't collapse under the pointer.
const dragSourceCol = ref<number | null>(null);

// Preview shows the email as it will be sent, so the drop chrome is edit-only,
// as on the empty canvas. A column whose blocks the condition filter hides
// holds only the condition's raw tags there, which take no height.
function holdsDropHeight(colIndex: number): boolean {
  if (editor.state.previewMode) return false;
  if (showsNoBlocks(colIndex)) return true;
  if (dragSourceCol.value !== colIndex) return false;
  return (
    getColumnBlocks(colIndex).filter((child) => isChildShown(child.id))
      .length <= 1
  );
}

// A hero waiting for its image (the Hero shortcut inserts one without) says
// what's missing. Edit-only, like the drop hints.
const showsHeroImageHint = computed(() => {
  if (editor.state.previewMode) return false;
  const hero = resolveHero(props.block);
  return hero !== null && !hero.applied && hero.reason === "image";
});

// Gates the dashed border and the drop hint, mirroring Canvas's `isEmptyCanvas`.
function isEmptyColumn(colIndex: number): boolean {
  return getColumnBlocks(colIndex).length === 0 && !editor.state.previewMode;
}

// In preview, a column with no blocks is as tall as the renderer's
// `<mj-text>&nbsp;</mj-text>` placeholder for it: 34px, mj-text's 10px top and
// bottom padding around one 14px line. The renderer's mjml-fidelity tests pin
// that height.
function holdsPlaceholderHeight(colIndex: number): boolean {
  return getColumnBlocks(colIndex).length === 0 && editor.state.previewMode;
}

function setColumnBlocks(colIndex: number, blocks: Block[]): void {
  updateBlockList(editor, blocks, props.block.id, colIndex);
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
  <div class="tpl:relative tpl:w-full">
    <!-- In the section's top padding, above the content, so it covers none of it. -->
    <div
      v-if="showsHeroImageHint"
      data-testid="hero-image-hint"
      class="tpl:pointer-events-none tpl:absolute tpl:inset-x-0 tpl:bottom-full tpl:mb-2 tpl:flex tpl:justify-center tpl:text-xs tpl:text-[var(--tpl-chrome-text-dim)]"
    >
      <span>{{ t.section.heroAddImage }}</span>
    </div>
    <div
      class="tpl:flex tpl:gap-0"
      :class="{ 'tpl:flex-col': isMobileStacked }"
    >
      <div
        v-for="(_, colIndex) in columns"
        :key="colIndex"
        class="tpl:relative tpl:flex tpl:flex-col tpl:rounded"
        :class="
          isEmptyColumn(colIndex)
            ? 'tpl:border tpl:border-dashed tpl:border-[var(--tpl-border)]'
            : ''
        "
        :style="{ width: isMobileStacked ? '100%' : columnWidths[colIndex] }"
      >
        <!-- The list grows to the column's full height, so the whole visible
             column takes drops, not just the area its blocks cover. -->
        <VueDraggable
          :model-value="getColumnBlocks(colIndex)"
          :group="{
            name: 'blocks',
            pull: true,
            put: (_to: unknown, _from: unknown, el: HTMLElement) =>
              canDropInSectionColumn(el),
          }"
          :animation="150"
          ghost-class="tpl-ghost"
          drag-class="tpl-dragging"
          handle=".tpl-block-btn"
          :invert-swap="true"
          :inverted-swap-threshold="0.65"
          :empty-insert-threshold="20"
          :force-fallback="true"
          class="tpl:grow"
          :class="{
            'tpl:min-h-[60px]': holdsDropHeight(colIndex),
            'tpl:min-h-[34px]': holdsPlaceholderHeight(colIndex),
          }"
          @update="
            (event) =>
              updateBlockList(
                editor,
                getColumnBlocks(colIndex),
                props.block.id,
                colIndex,
                event,
              )
          "
          @start="dragSourceCol = colIndex"
          @end="dragSourceCol = null"
          @update:model-value="(val: Block[]) => setColumnBlocks(colIndex, val)"
        >
          <div
            v-for="childBlock in getColumnBlocks(colIndex)"
            :key="childBlock.id"
            v-show="isChildShown(childBlock.id)"
          >
            <BlockWrapper
              :block="childBlock"
              :display-block="displayBlock(childBlock)"
              :is-selected="editor.state.selectedBlockId === childBlock.id"
              :viewport="viewport"
              :preview-mode="editor.state.previewMode"
              nested
              @select="handleChildSelect(childBlock.id)"
            >
              <component
                :is="getBlockComponent(childBlock)"
                :block="displayBlock(childBlock)"
                :viewport="viewport"
                @fetch-data="handleFetchData(childBlock, $event)"
                @update="
                  (updates: Partial<Block>) =>
                    editor.updateBlock(childBlock.id, updates)
                "
              />
            </BlockWrapper>
          </div>
        </VueDraggable>
        <div
          v-if="isEmptyColumn(colIndex)"
          data-testid="section-drop-hint"
          class="tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:flex tpl:items-center tpl:justify-center tpl:text-xs tpl:text-[var(--tpl-chrome-text-dim)]"
        >
          <span>{{ t.section.dropHere }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
