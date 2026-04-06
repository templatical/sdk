<script setup lang="ts">
import ButtonToolbar from "./toolbar/ButtonToolbar.vue";
import CommonBlockSettings from "./toolbar/CommonBlockSettings.vue";
import CountdownToolbar from "./toolbar/CountdownToolbar.vue";
import CustomBlockToolbar from "./toolbar/CustomBlockToolbar.vue";
import DividerToolbar from "./toolbar/DividerToolbar.vue";
import HtmlToolbar from "./toolbar/HtmlToolbar.vue";
import ImageToolbar from "./toolbar/ImageToolbar.vue";
import MenuToolbar from "./toolbar/MenuToolbar.vue";
import SectionToolbar from "./toolbar/SectionToolbar.vue";
import SocialToolbar from "./toolbar/SocialToolbar.vue";
import SpacerToolbar from "./toolbar/SpacerToolbar.vue";
import TableToolbar from "./toolbar/TableToolbar.vue";
import TitleToolbar from "./toolbar/TitleToolbar.vue";
import { useI18n } from "../composables/useI18n";
import type { UseFontsReturn } from "../composables/useFonts";
import type {
  Block,
  ButtonBlock,
  CountdownBlock,
  CustomBlock,
  CustomBlockDefinition,
  DividerBlock,
  HtmlBlock,
  ImageBlock,
  MenuBlock,
  SectionBlock,
  SocialIconsBlock,
  SpacerBlock,
  TableBlock,
  TitleBlock,
} from "@templatical/types";
import { isCustomBlock } from "@templatical/types";
import {
  Code,
  Columns3,
  Copy,
  Heading,
  Image,
  Minus,
  MoveVertical,
  Navigation,
  Pilcrow,
  RectangleHorizontal,
  Share2,
  Table,
  Timer,
  Trash2,
} from "@lucide/vue";
import { computed, inject } from "vue";

const props = defineProps<{
  block: Block;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<Block>): void;
  (e: "delete"): void;
  (e: "duplicate"): void;
}>();

const { t } = useI18n();

const fontsManager = inject<UseFontsReturn>("fontsManager")!;
const customBlockDefinitions = inject<CustomBlockDefinition[]>(
  "customBlockDefinitions",
  [],
);

const blockType = computed(() => props.block.type);

const isCustom = computed(() => isCustomBlock(props.block));

const customBlockDefinition = computed(() => {
  if (!isCustom.value) {
    return undefined;
  }
  return customBlockDefinitions.find(
    (d) => d.type === (props.block as CustomBlock).customType,
  );
});

const blockTypeLabel = computed(() => {
  if (isCustom.value) {
    return (
      customBlockDefinition.value?.name ??
      (props.block as CustomBlock).customType
    );
  }

  const labels: Record<string, string> = {
    section: t.blocks.section,
    image: t.blocks.image,
    title: t.blocks.title,
    paragraph: t.blocks.paragraph,
    button: t.blocks.button,
    divider: t.blocks.divider,
    social: t.blocks.social,
    menu: t.blocks.menu,
    table: t.blocks.table,
    spacer: t.blocks.spacer,
    countdown: t.blocks.countdown,
    html: t.blocks.html,
  };
  return labels[blockType.value] || blockType.value;
});

// Font families from shared fontsManager (provided by Editor.vue / CloudEditor.vue)
const fontFamilies = fontsManager.fonts;

function handleUpdate(updates: Partial<Block>): void {
  emit("update", updates);
}
</script>

<template>
  <aside
    class="tpl:flex tpl:w-full tpl:flex-1 tpl:flex-col tpl:bg-[var(--tpl-bg-elevated)]"
  >
    <div
      class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-4 tpl:py-3.5"
    >
      <div
        class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-[var(--tpl-primary)]"
      >
        <Columns3
          v-if="blockType === 'section'"
          :size="16"
          :stroke-width="1.5"
        />
        <Heading v-if="blockType === 'title'" :size="16" :stroke-width="1.5" />
        <Pilcrow
          v-else-if="blockType === 'paragraph'"
          :size="16"
          :stroke-width="1.5"
        />
        <Image
          v-else-if="blockType === 'image'"
          :size="16"
          :stroke-width="1.5"
        />
        <RectangleHorizontal
          v-else-if="blockType === 'button'"
          :size="16"
          :stroke-width="1.5"
        />
        <Minus
          v-else-if="blockType === 'divider'"
          :size="16"
          :stroke-width="1.5"
        />
        <Share2
          v-else-if="blockType === 'social'"
          :size="16"
          :stroke-width="1.5"
        />
        <Navigation
          v-else-if="blockType === 'menu'"
          :size="16"
          :stroke-width="1.5"
        />
        <Table
          v-else-if="blockType === 'table'"
          :size="16"
          :stroke-width="1.5"
        />
        <MoveVertical
          v-else-if="blockType === 'spacer'"
          :size="16"
          :stroke-width="1.5"
        />
        <Timer
          v-else-if="blockType === 'countdown'"
          :size="16"
          :stroke-width="1.5"
        />
        <Code v-else-if="blockType === 'html'" :size="16" :stroke-width="1.5" />
        <Code v-else-if="isCustom" :size="16" :stroke-width="1.5" />
        <h3
          class="tpl:m-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{ blockTypeLabel }}
        </h3>
      </div>
      <div class="tpl:flex tpl:gap-1">
        <button
          class="tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-bg-active)] tpl:hover:text-[var(--tpl-text)]"
          :title="t.toolbar.duplicate"
          @click="emit('duplicate')"
        >
          <Copy :size="14" :stroke-width="2" />
        </button>
        <button
          class="tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-danger)] tpl:hover:bg-[var(--tpl-danger-light)] tpl:hover:text-[var(--tpl-danger)]"
          :title="t.toolbar.delete"
          @click="emit('delete')"
        >
          <Trash2 :size="14" :stroke-width="2" />
        </button>
      </div>
    </div>

    <div class="tpl:flex-1 tpl:overflow-y-auto tpl:p-4">
      <template v-if="isCustom">
        <CustomBlockToolbar
          :block="block as CustomBlock"
          @update-field-values="emit('update', { fieldValues: $event })"
          @update-data-source-fetched="
            emit('update', { dataSourceFetched: $event })
          "
        />
      </template>

      <SectionToolbar
        v-else-if="blockType === 'section'"
        :block="block as SectionBlock"
        @update="handleUpdate"
      />

      <TitleToolbar
        v-else-if="blockType === 'title'"
        :block="block as TitleBlock"
        :font-families="fontFamilies"
        @update="handleUpdate"
      />

      <!-- Paragraph block: no text-specific sidebar controls — all formatting is in the TipTap toolbar -->
      <template v-else-if="blockType === 'paragraph'" />

      <ImageToolbar
        v-else-if="blockType === 'image'"
        :block="block as ImageBlock"
        @update="handleUpdate"
      />

      <ButtonToolbar
        v-else-if="blockType === 'button'"
        :block="block as ButtonBlock"
        :font-families="fontFamilies"
        @update="handleUpdate"
      />

      <DividerToolbar
        v-else-if="blockType === 'divider'"
        :block="block as DividerBlock"
        @update="handleUpdate"
      />

      <SocialToolbar
        v-else-if="blockType === 'social'"
        :block="block as SocialIconsBlock"
        @update="handleUpdate"
      />

      <MenuToolbar
        v-else-if="blockType === 'menu'"
        :block="block as MenuBlock"
        :font-families="fontFamilies"
        @update="handleUpdate"
      />

      <TableToolbar
        v-else-if="blockType === 'table'"
        :block="block as TableBlock"
        :font-families="fontFamilies"
        @update="handleUpdate"
      />

      <SpacerToolbar
        v-else-if="blockType === 'spacer'"
        :block="block as SpacerBlock"
        @update="handleUpdate"
      />

      <HtmlToolbar
        v-else-if="blockType === 'html'"
        :block="block as HtmlBlock"
        @update="handleUpdate"
      />

      <CountdownToolbar
        v-else-if="blockType === 'countdown'"
        :block="block as CountdownBlock"
        :font-families="fontFamilies"
        @update="handleUpdate"
      />

      <!-- Common block settings -->
      <CommonBlockSettings
        :block="block"
        :is-first-section="blockType === 'paragraph'"
        @update="handleUpdate"
      />
    </div>
  </aside>
</template>

<style scoped>
.tpl-collapsible {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-collapsible--open {
  grid-template-rows: 1fr;
}

.tpl-collapsible > div {
  overflow: hidden;
}
</style>
