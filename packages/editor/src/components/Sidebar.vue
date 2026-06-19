<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { useCloudI18n } from "../composables/useCloudI18n";
import type { Block, BlockType } from "@templatical/types";
import { createBlock, createCustomBlock } from "@templatical/types";
import { Package } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import CustomBlockIcon from "./CustomBlockIcon.vue";
import { blockTypeIcons } from "../utils/blockTypeIcons";
import { getBlockTypeLabel } from "../utils/blockTypeLabels";
import {
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  BLOCK_DEFAULTS_KEY,
  CAPABILITIES_KEY,
  EDITOR_KEY,
} from "../keys";

interface BlockTypeItem {
  type: BlockType | string;
  label: string;
  isCustom?: boolean;
  icon?: string;
}

const { t, format } = useI18n();
const { t: cloudT } = useCloudI18n();
const customBlockDefinitions = inject(CUSTOM_BLOCK_DEFINITIONS_KEY, []);
const blockDefaults = inject(BLOCK_DEFAULTS_KEY, undefined);
const editor = inject(EDITOR_KEY, null);

const caps = inject(CAPABILITIES_KEY, {});

const showModulesSection = computed(
  () => (caps.savedModules?.moduleCount.value ?? 0) > 0,
);

const isExpanded = ref(false);
const isDragging = ref(false);

function handleSidebarLeave(): void {
  // Don't collapse while a Sortable drag is in progress. If the sidebar
  // shrinks (200px → 48px) DURING the drag's threshold-to-dragStarted
  // window, `dragEl.getBoundingClientRect()` returns a mid-transition
  // rect when Sortable's `_appendGhost` runs — the fallback ghost gets
  // stamped with that wrong rect and ends up visibly offset from the
  // cursor for the rest of the drag. Cleared on drag-end.
  if (isDragging.value) return;
  isExpanded.value = false;
}

function handleDragChoose(): void {
  // `choose` fires synchronously inside Sortable's `_onTapStart` at
  // pointerdown, BEFORE any pointermove or mouseleave. `start` would be
  // too late — it fires only after the threshold-move dispatches
  // `_dragStarted`, by which time mouseleave may already have flipped
  // `isExpanded` and the sidebar may be mid-collapse.
  isDragging.value = true;
}

function handleDragEnd(): void {
  isDragging.value = false;
}

const builtInBlockTypeOrder: string[] = [
  "section",
  "image",
  "title",
  "paragraph",
  "button",
  "divider",
  "video",
  "social",
  "menu",
  "table",
  "spacer",
  "html",
];

const builtInBlockTypes = computed<BlockTypeItem[]>(() => {
  const types: BlockTypeItem[] = builtInBlockTypeOrder.map((type) => ({
    type,
    label: getBlockTypeLabel(type, t),
  }));

  // Countdown requires Templatical Cloud for server-side GIF rendering
  if (caps.plan) {
    types.splice(-1, 0, {
      type: "countdown",
      label: getBlockTypeLabel("countdown", t),
    });
  }

  return types;
});

const customBlockItems = computed<BlockTypeItem[]>(() => {
  return customBlockDefinitions.map((def) => ({
    type: `custom:${def.type}`,
    label: def.name,
    isCustom: true,
    icon: def.icon,
  }));
});

const blockTypes = computed<BlockTypeItem[]>(() => [
  ...builtInBlockTypes.value,
  ...customBlockItems.value,
]);

function createBlockFromItem(item: BlockTypeItem): Block {
  if (item.isCustom) {
    const customType = item.type.replace("custom:", "");
    const definition = customBlockDefinitions.find(
      (d) => d.type === customType,
    );
    if (definition) {
      return createCustomBlock(definition);
    }
  }

  return createBlock(item.type as BlockType, blockDefaults);
}

function insertBlockFromItem(item: BlockTypeItem): void {
  if (!editor) return;
  const block = createBlockFromItem(item);
  editor.addBlock(block);
  editor.selectBlock(block.id);
}

function handlePaletteKeydown(event: KeyboardEvent, item: BlockTypeItem): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    insertBlockFromItem(item);
  }
}
</script>

<template>
  <aside
    :aria-label="t.sidebarNav.palette"
    class="tpl-sidebar-rail tpl:absolute tpl:top-14 tpl:bottom-0 tpl:left-0 tpl:z-40 tpl:flex tpl:flex-col tpl:overflow-hidden"
    :style="{
      width: isExpanded ? '200px' : '48px',
      backgroundColor: 'var(--tpl-bg-elevated)',
      borderRight: '1px solid var(--tpl-border)',
      boxShadow: isExpanded ? 'var(--tpl-shadow-lg)' : 'none',
      transition:
        'width 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    }"
    @mouseenter="isExpanded = true"
    @mouseleave="handleSidebarLeave"
    @focusin="isExpanded = true"
    @focusout="isExpanded = false"
  >
    <!-- Saved Modules browser trigger (cloud only) -->
    <div
      v-if="showModulesSection && cloudT"
      class="tpl:border-b tpl:px-1 tpl:pb-1 tpl:border-[var(--tpl-border)]"
    >
      <button
        type="button"
        :aria-label="t.sidebarNav.browseModules"
        class="tpl:flex tpl:h-10 tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-3 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:px-3 tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-[120ms] hover:tpl:bg-[var(--tpl-primary-light)] hover:tpl:text-[var(--tpl-primary)]"
        :style="{
          justifyContent: isExpanded ? 'flex-start' : 'center',
        }"
        @click="caps.savedModules?.openBrowser()"
      >
        <Package :size="20" :stroke-width="1.5" class="tpl:shrink-0" />
        <span
          v-if="isExpanded"
          class="tpl:flex-1 tpl:truncate tpl:text-sm tpl:font-medium"
        >
          {{ cloudT.modules.title }}
        </span>
        <span
          v-if="isExpanded"
          class="tpl:shrink-0 tpl:rounded-full tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:bg-[var(--tpl-bg-hover)] tpl:text-[var(--tpl-text-muted)]"
        >
          {{ caps.savedModules?.moduleCount.value ?? 0 }}
        </span>
      </button>
    </div>
    <!-- The palette is the rail's scroll region: `flex-1` makes it fill the
         height left by the (optional) modules trigger, `min-h-0` lets it
         shrink below its content so `overflow-y-auto` engages. Without this
         the rail's `overflow-hidden` clips items below the fold on short
         viewports with no way to reach them (#231). -->
    <VueDraggable
      :model-value="blockTypes"
      :group="{ name: 'blocks', pull: 'clone', put: false }"
      :clone="createBlockFromItem"
      :sort="false"
      :animation="150"
      ghost-class="tpl-ghost"
      :force-fallback="true"
      class="tpl:flex tpl:min-h-0 tpl:flex-1 tpl:flex-col tpl:gap-0.5 tpl:overflow-y-auto tpl:p-1"
      @choose="handleDragChoose"
      @end="handleDragEnd"
    >
      <button
        v-for="blockType in blockTypes"
        :key="blockType.type"
        type="button"
        :data-palette-type="blockType.type"
        :aria-label="
          format(t.sidebarNav.insertBlock, { block: blockType.label })
        "
        class="tpl:flex tpl:h-10 tpl:w-full tpl:shrink-0 tpl:cursor-grab tpl:items-center tpl:gap-3 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:px-3 tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] hover:tpl:bg-[var(--tpl-primary-light)] hover:tpl:text-[var(--tpl-primary)] active:tpl:cursor-grabbing"
        :style="{
          justifyContent: isExpanded ? 'flex-start' : 'center',
        }"
        @click="insertBlockFromItem(blockType)"
        @keydown="handlePaletteKeydown($event, blockType)"
      >
        <div
          class="tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-center tpl:transition-transform tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] hover:tpl:scale-105"
        >
          <component
            :is="blockTypeIcons[blockType.type]"
            v-if="blockTypeIcons[blockType.type]"
            :size="20"
            :stroke-width="1.5"
          />
          <CustomBlockIcon
            v-else-if="blockType.isCustom"
            :icon="blockType.icon"
            :size="20"
          />
        </div>
        <span
          v-if="isExpanded"
          class="tpl:truncate tpl:text-sm tpl:font-medium"
        >
          {{ blockType.label }}
        </span>
      </button>
    </VueDraggable>
  </aside>
</template>
