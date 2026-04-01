<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import type {
  Block,
  BlockDefaults,
  BlockType,
  CustomBlockDefinition,
} from "@templatical/types";
import { createBlock, createCustomBlock } from "@templatical/types";
import {
  Code,
  Columns3,
  Image,
  Minus,
  MoveVertical,
  Navigation,
  Package,
  Play,
  RectangleHorizontal,
  Share2,
  Table,
  Timer,
  Type,
} from "lucide-vue-next";
import { computed, inject, ref } from "vue";
import draggable from "vuedraggable";
import CustomBlockIcon from "./CustomBlockIcon.vue";

interface BlockTypeItem {
  type: BlockType | string;
  label: string;
  isCustom?: boolean;
  icon?: string;
}

const { t } = useI18n();
const customBlockDefinitions = inject<CustomBlockDefinition[]>(
  "customBlockDefinitions",
  [],
);
const blockDefaults = inject<BlockDefaults | undefined>(
  "blockDefaults",
  undefined,
);

// Cloud-only injects — null in OSS mode

const savedModulesVisual = inject<any>("savedModules", null);

const planConfig = inject<any>("planConfig", null);

const showModulesSection = computed(
  () => !!savedModulesVisual && !!planConfig?.hasFeature("saved_modules"),
);

const isExpanded = ref(false);

const isCloudMode = computed(() => !!planConfig);

const builtInBlockTypes = computed<BlockTypeItem[]>(() => {
  const types: BlockTypeItem[] = [
    { type: "section", label: t.blocks.section },
    { type: "image", label: t.blocks.image },
    { type: "text", label: t.blocks.text },
    { type: "button", label: t.blocks.button },
    { type: "divider", label: t.blocks.divider },
    { type: "video", label: t.blocks.video },
    { type: "social", label: t.blocks.social },
    { type: "menu", label: t.blocks.menu },
    { type: "table", label: t.blocks.table },
    { type: "spacer", label: t.blocks.spacer },
    { type: "html", label: t.blocks.html },
  ];

  // Countdown requires Templatical Cloud for server-side GIF rendering
  if (isCloudMode.value) {
    types.splice(-1, 0, { type: "countdown", label: t.blocks.countdown });
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

function cloneBlock(item: BlockTypeItem): Block {
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
</script>

<template>
  <aside
    :aria-expanded="isExpanded"
    :aria-label="t.sidebarNav.expandSidebar"
    class="tpl-sidebar-rail tpl:absolute tpl:top-14 tpl:bottom-0 tpl:left-0 tpl:z-40 tpl:overflow-hidden"
    :style="{
      width: isExpanded ? '200px' : '48px',
      backgroundColor: 'var(--tpl-bg-elevated)',
      borderRight: '1px solid var(--tpl-border)',
      boxShadow: isExpanded ? 'var(--tpl-shadow-lg)' : 'none',
      transition:
        'width 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    }"
    @mouseenter="isExpanded = true"
    @mouseleave="isExpanded = false"
    @focusin="isExpanded = true"
    @focusout="isExpanded = false"
  >
    <!-- Saved Modules browser trigger (cloud only) -->
    <div
      v-if="
        showModulesSection &&
        savedModulesVisual!.headless.modules.value.length > 0
      "
      class="tpl:border-b tpl:px-1 tpl:pb-1"
      style="border-color: var(--tpl-border)"
    >
      <button
        type="button"
        :aria-label="t.sidebarNav.browseModules"
        class="tpl:flex tpl:h-10 tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-3 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:px-3 tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-[120ms] hover:tpl:bg-[var(--tpl-primary-light)] hover:tpl:text-[var(--tpl-primary)]"
        :style="{
          justifyContent: isExpanded ? 'flex-start' : 'center',
        }"
        @click="savedModulesVisual!.openBrowserModal()"
      >
        <Package :size="20" :stroke-width="1.5" class="tpl:shrink-0" />
        <span
          v-if="isExpanded"
          class="tpl:flex-1 tpl:truncate tpl:text-sm tpl:font-medium"
        >
          {{ t.modules.title }}
        </span>
        <span
          v-if="isExpanded"
          class="tpl:shrink-0 tpl:rounded-full tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium"
          style="
            background-color: var(--tpl-bg-hover);
            color: var(--tpl-text-muted);
          "
        >
          {{ savedModulesVisual!.headless.modules.value.length }}
        </span>
      </button>
    </div>
    <draggable
      :list="blockTypes"
      :group="{ name: 'blocks', pull: 'clone', put: false }"
      :clone="cloneBlock"
      :sort="false"
      item-key="type"
      :animation="150"
      ghost-class="tpl-ghost"
      class="tpl:flex tpl:flex-col tpl:gap-0.5 tpl:p-1"
    >
      <template #item="{ element: blockType }">
        <div
          class="tpl:flex tpl:h-10 tpl:cursor-grab tpl:items-center tpl:gap-3 tpl:rounded-[var(--tpl-radius-sm)] tpl:px-3 tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] hover:tpl:bg-[var(--tpl-primary-light)] hover:tpl:text-[var(--tpl-primary)] active:tpl:cursor-grabbing"
          :style="{
            justifyContent: isExpanded ? 'flex-start' : 'center',
          }"
        >
          <div
            class="tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-center tpl:transition-transform tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] hover:tpl:scale-105"
          >
            <Image
              v-if="blockType.type === 'image'"
              :size="20"
              :stroke-width="1.5"
            />
            <Type
              v-else-if="blockType.type === 'text'"
              :size="20"
              :stroke-width="1.5"
            />
            <RectangleHorizontal
              v-else-if="blockType.type === 'button'"
              :size="20"
              :stroke-width="1.5"
            />
            <Minus
              v-else-if="blockType.type === 'divider'"
              :size="20"
              :stroke-width="1.5"
            />
            <Play
              v-else-if="blockType.type === 'video'"
              :size="20"
              :stroke-width="1.5"
            />
            <Columns3
              v-else-if="blockType.type === 'section'"
              :size="20"
              :stroke-width="1.5"
            />
            <Share2
              v-else-if="blockType.type === 'social'"
              :size="20"
              :stroke-width="1.5"
            />
            <Navigation
              v-else-if="blockType.type === 'menu'"
              :size="20"
              :stroke-width="1.5"
            />
            <Table
              v-else-if="blockType.type === 'table'"
              :size="20"
              :stroke-width="1.5"
            />
            <MoveVertical
              v-else-if="blockType.type === 'spacer'"
              :size="20"
              :stroke-width="1.5"
            />
            <Timer
              v-else-if="blockType.type === 'countdown'"
              :size="20"
              :stroke-width="1.5"
            />
            <Code
              v-else-if="blockType.type === 'html'"
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
        </div>
      </template>
    </draggable>
  </aside>
</template>
