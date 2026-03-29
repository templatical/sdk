<script setup lang="ts">
import ColorPicker from "./ColorPicker.vue";
import CustomBlockToolbar from "./toolbar/CustomBlockToolbar.vue";
import MergeTagInput from "./MergeTagInput.vue";
import SlidingPillSelect from "./SlidingPillSelect.vue";
import SpacingControl from "./SpacingControl.vue";
import { useI18n } from "../composables/useI18n";
import { socialIcons, socialPlatformOptions } from "../constants/socialIcons";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../constants/styleConstants";
import type { TemplaticalEditorConfig } from "../index";
import type {
  Block,
  ButtonBlock,
  ColumnLayout,
  CustomBlock,
  DisplayCondition,
  DividerBlock,
  HtmlBlock,
  ImageBlock,
  MenuBlock,
  MenuItemData,
  MergeTag,
  SectionBlock,
  SocialIcon,
  SocialIconsBlock,
  SocialPlatform,
  SpacerBlock,
  TableBlock,
  TableCellData,
  TableRowData,
  TextBlock,
  CustomBlockDefinition,
  CustomFont,
} from "@templatical/types";
import {
  isCustomBlock,
  generateId,
  containsMergeTag,
  SYNTAX_PRESETS,
} from "@templatical/types";
import type { SyntaxPreset } from "@templatical/types";
import type { UseEditorReturn } from "@templatical/core";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Code,
  Columns3,
  Copy,
  Image,
  Info,
  Minus,
  Monitor,
  MoveVertical,
  Navigation,
  Plus,
  RectangleHorizontal,
  Share2,
  Smartphone,
  Table,
  Tablet,
  Trash2,
  Type,
  X,
} from "lucide-vue-next";
import { computed, inject, ref, watch } from "vue";
import { useTimeoutFn } from "@vueuse/core";

const props = defineProps<{
  block: Block;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<Block>): void;
  (e: "delete"): void;
  (e: "duplicate"): void;
}>();

const { t } = useI18n();

const _editor = inject<UseEditorReturn>("editor")!;
const config = inject<TemplaticalEditorConfig>("config");
const _mergeTags = inject<MergeTag[]>("mergeTags", []);
const mergeTagSyntax = inject<SyntaxPreset>(
  "mergeTagSyntax",
  SYNTAX_PRESETS.liquid,
);
const displayConditions = inject<DisplayCondition[]>("displayConditions", []);
const allowCustomConditions = inject<boolean>("allowCustomConditions", false);
const customBlockDefinitions = inject<CustomBlockDefinition[]>(
  "customBlockDefinitions",
  [],
);

// Font families - use injected config or defaults
const fontFamilies = computed<Array<{ value: string; label: string }>>(() => {
  const configFonts = (config?.theme as Record<string, unknown>)?.fonts as
    | CustomFont[]
    | undefined;
  if (configFonts && configFonts.length > 0) {
    return configFonts.map((f) => ({
      value: typeof f === "string" ? f : f.name,
      label: typeof f === "string" ? f : f.name,
    }));
  }
  return [
    { value: "Arial", label: "Arial" },
    { value: "Helvetica", label: "Helvetica" },
    { value: "Georgia", label: "Georgia" },
    { value: "Times New Roman", label: "Times New Roman" },
    { value: "Courier New", label: "Courier New" },
    { value: "Verdana", label: "Verdana" },
    { value: "Trebuchet MS", label: "Trebuchet MS" },
  ];
});

const canBrowseMedia = computed(() => !!config?.onRequestMedia);

const pulseSrc = ref(false);
const pulseAlt = ref(false);
const spacingOpen = ref(false);
const bgOpen = ref(false);
const displayOpen = ref(false);
const cssOpen = ref(false);
const conditionOpen = ref(false);

const hasDisplayConditions = computed(
  () => displayConditions.length > 0 || allowCustomConditions,
);

const customConditionMode = ref(false);
const customBefore = ref("");
const customAfter = ref("");

const isCustomCondition = computed(() => {
  if (!props.block.displayCondition) {
    return false;
  }
  return !displayConditions.some(
    (c) => c.label === props.block.displayCondition?.label,
  );
});

function startCustomCondition(): void {
  customConditionMode.value = true;
  if (isCustomCondition.value && props.block.displayCondition) {
    customBefore.value = props.block.displayCondition.before;
    customAfter.value = props.block.displayCondition.after ?? "";
  } else {
    customBefore.value = "";
    customAfter.value = "";
  }
}

function applyCustomCondition(): void {
  if (!customBefore.value.trim()) {
    return;
  }
  emit("update", {
    displayCondition: {
      label: t.blockSettings.customCondition,
      before: customBefore.value.trim(),
      after: customAfter.value.trim(),
    },
  });
  customConditionMode.value = false;
  customBefore.value = "";
  customAfter.value = "";
}

watch(
  () => props.block.displayCondition,
  (condition) => {
    if (!condition) {
      customConditionMode.value = false;
      customBefore.value = "";
      customAfter.value = "";
      return;
    }
    if (isCustomCondition.value) {
      customBefore.value = condition.before;
      customAfter.value = condition.after ?? "";
    }
  },
  { immediate: true },
);

const groupedDisplayConditions = computed(() => {
  const groups: Record<string, DisplayCondition[]> = {};
  for (const condition of displayConditions) {
    const group = condition.group ?? "";
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(condition);
  }
  return groups;
});

async function openMediaBrowser(): Promise<void> {
  const result = await config?.onRequestMedia?.();
  if (result) {
    updateField("src", result.url);
    if (result.alt) updateField("alt", result.alt);
    pulseSrc.value = true;
    useTimeoutFn(() => {
      pulseSrc.value = false;
    }, 1000);
  }
}

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
    text: t.blocks.text,
    button: t.blocks.button,
    divider: t.blocks.divider,
    social: t.blocks.social,
    menu: t.blocks.menu,
    table: t.blocks.table,
    spacer: t.blocks.spacer,
    html: t.blocks.html,
  };
  return labels[blockType.value] || blockType.value;
});

const tableColumnCount = computed(() => {
  const rows = (props.block as TableBlock).rows;
  return rows.length > 0 ? rows[0].cells.length : 0;
});

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<Block>);
}

function updateStyle(field: string, value: unknown): void {
  emit("update", {
    styles: {
      ...props.block.styles,
      [field]: value,
    },
  });
}

const columnOptions = computed(() => [
  { value: "1" as ColumnLayout, label: t.section.column1 },
  { value: "2" as ColumnLayout, label: t.section.column2 },
  { value: "3" as ColumnLayout, label: t.section.column3 },
  { value: "1-2" as ColumnLayout, label: t.section.ratio12 },
  { value: "2-1" as ColumnLayout, label: t.section.ratio21 },
]);

function addSocialIcon(): void {
  const currentIcons = (props.block as SocialIconsBlock).icons;
  const newIcon: SocialIcon = {
    id: generateId(),
    platform: "facebook",
    url: "",
  };
  emit("update", { icons: [...currentIcons, newIcon] });
}

function updateSocialIcon(
  iconId: string,
  field: keyof SocialIcon,
  value: string,
): void {
  const currentIcons = (props.block as SocialIconsBlock).icons;
  const updatedIcons = currentIcons.map((icon) =>
    icon.id === iconId ? { ...icon, [field]: value } : icon,
  );
  emit("update", { icons: updatedIcons });
}

function removeSocialIcon(iconId: string): void {
  const currentIcons = (props.block as SocialIconsBlock).icons;
  emit("update", {
    icons: currentIcons.filter((icon) => icon.id !== iconId),
  });
}

function addMenuItem(): void {
  const currentItems = (props.block as MenuBlock).items;
  const newItem: MenuItemData = {
    id: generateId(),
    text: "",
    url: "",
    openInNewTab: false,
    bold: false,
    underline: false,
  };
  emit("update", { items: [...currentItems, newItem] });
}

function updateMenuItem(
  itemId: string,
  field: keyof MenuItemData,
  value: unknown,
): void {
  const currentItems = (props.block as MenuBlock).items;
  const updatedItems = currentItems.map((item) =>
    item.id === itemId ? { ...item, [field]: value } : item,
  );
  emit("update", { items: updatedItems });
}

function removeMenuItem(itemId: string): void {
  const currentItems = (props.block as MenuBlock).items;
  emit("update", {
    items: currentItems.filter((item) => item.id !== itemId),
  });
}

function addTableRow(): void {
  const currentRows = (props.block as TableBlock).rows;
  const columnCount = currentRows.length > 0 ? currentRows[0].cells.length : 3;
  const newRow: TableRowData = {
    id: generateId(),
    cells: Array.from(
      { length: columnCount },
      (): TableCellData => ({
        id: generateId(),
        content: "",
      }),
    ),
  };
  emit("update", { rows: [...currentRows, newRow] });
}

function removeTableRow(rowId: string): void {
  const currentRows = (props.block as TableBlock).rows;
  emit("update", {
    rows: currentRows.filter((row) => row.id !== rowId),
  });
}

function addTableColumn(): void {
  const currentRows = (props.block as TableBlock).rows;
  const updatedRows = currentRows.map((row) => ({
    ...row,
    cells: [...row.cells, { id: generateId(), content: "" } as TableCellData],
  }));
  emit("update", { rows: updatedRows });
}

function removeTableColumn(colIndex: number): void {
  const currentRows = (props.block as TableBlock).rows;
  const updatedRows = currentRows.map((row) => ({
    ...row,
    cells: row.cells.filter((_, i) => i !== colIndex),
  }));
  emit("update", { rows: updatedRows });
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
        <Type v-else-if="blockType === 'text'" :size="16" :stroke-width="1.5" />
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

      <template v-else-if="blockType === 'section'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.section.columns }}</label>
          <select
            :class="inputClass"
            :value="(block as SectionBlock).columns"
            @change="
              updateField(
                'columns',
                ($event.target as HTMLSelectElement).value as ColumnLayout,
              )
            "
          >
            <option
              v-for="option in columnOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
      </template>

      <template v-else-if="blockType === 'text'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.text.fontFamily }}</label>
          <select
            :class="inputClass"
            :value="(block as TextBlock).fontFamily || ''"
            @change="
              updateField(
                'fontFamily',
                ($event.target as HTMLSelectElement).value || undefined,
              )
            "
          >
            <option value="">{{ t.text.inheritFont }}</option>
            <option
              v-for="font in fontFamilies"
              :key="font.value"
              :value="font.value"
            >
              {{ font.label }}
            </option>
          </select>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.text.fontSize }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="(block as TextBlock).fontSize"
              min="10"
              max="72"
              @input="
                updateField(
                  'fontSize',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.text.color }}</label>
          <ColorPicker
            :model-value="(block as TextBlock).color"
            @update:model-value="updateField('color', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.text.align }}</label>
          <SlidingPillSelect
            :options="[
              {
                value: 'left',
                label: t.text.alignLeft,
                icon: AlignLeft,
              },
              {
                value: 'center',
                label: t.text.alignCenter,
                icon: AlignCenter,
              },
              {
                value: 'right',
                label: t.text.alignRight,
                icon: AlignRight,
              },
            ]"
            :model-value="(block as TextBlock).textAlign"
            @update:model-value="updateField('textAlign', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.text.weight }}</label>
          <SlidingPillSelect
            :options="[
              { value: 'normal', label: t.text.normal },
              { value: 'bold', label: t.text.bold },
            ]"
            :model-value="(block as TextBlock).fontWeight"
            @update:model-value="updateField('fontWeight', $event)"
          />
        </div>
      </template>

      <template v-else-if="blockType === 'image'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.image.imageUrl }}</label>
          <MergeTagInput
            :model-value="(block as ImageBlock).src"
            type="url"
            :placeholder="t.image.imageUrlPlaceholder"
            :pulse="pulseSrc"
            @update:model-value="updateField('src', $event)"
          />
          <button
            v-if="canBrowseMedia"
            class="tpl:mt-2 tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
            style="
              border-color: var(--tpl-border);
              color: var(--tpl-primary);
              background-color: var(--tpl-bg);
            "
            @click="openMediaBrowser"
          >
            <Image :size="14" :stroke-width="1.5" />
            {{ t.image.browseMedia }}
          </button>
        </div>
        <div
          v-if="containsMergeTag((block as ImageBlock).src, mergeTagSyntax)"
          class="tpl:mb-3.5"
        >
          <label :class="labelClass"
            >{{ t.image.placeholderUrl }}
            <span class="tpl:font-normal tpl:text-[var(--tpl-text-dim)]">{{
              "(optional)"
            }}</span>
          </label>
          <input
            type="url"
            :class="inputClass"
            :value="(block as ImageBlock).placeholderUrl || ''"
            :placeholder="t.image.placeholderUrlPlaceholder"
            @input="
              updateField(
                'placeholderUrl',
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.image.altText }}</label>
          <MergeTagInput
            :model-value="(block as ImageBlock).alt"
            type="text"
            :placeholder="t.image.altTextPlaceholder"
            :pulse="pulseAlt"
            @update:model-value="updateField('alt', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.image.width }}</label>
          <select
            :class="inputClass"
            :value="(block as ImageBlock).width"
            @change="
              updateField(
                'width',
                ($event.target as HTMLSelectElement).value === 'full'
                  ? 'full'
                  : Number(($event.target as HTMLSelectElement).value),
              )
            "
          >
            <option value="full">{{ t.image.fullWidth }}</option>
            <option value="300">300px</option>
            <option value="400">400px</option>
            <option value="500">500px</option>
          </select>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.text.align }}</label>
          <SlidingPillSelect
            :options="[
              { value: 'left', label: t.text.alignLeft },
              { value: 'center', label: t.text.alignCenter },
              { value: 'right', label: t.text.alignRight },
            ]"
            :model-value="(block as ImageBlock).align"
            @update:model-value="updateField('align', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.image.linkUrl }}</label>
          <MergeTagInput
            :model-value="(block as ImageBlock).linkUrl || ''"
            type="url"
            :placeholder="t.image.imageUrlPlaceholder"
            @update:model-value="updateField('linkUrl', $event)"
          />
          <label
            v-if="(block as ImageBlock).linkUrl"
            class="tpl:mt-2 tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
          >
            <input
              type="checkbox"
              class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
              :checked="(block as ImageBlock).linkOpenInNewTab ?? false"
              @change="
                updateField(
                  'linkOpenInNewTab',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            {{ t.image.openInNewTab }}
          </label>
        </div>
      </template>

      <template v-else-if="blockType === 'button'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.button.fontFamily }}</label>
          <select
            :class="inputClass"
            :value="(block as ButtonBlock).fontFamily || ''"
            @change="
              updateField(
                'fontFamily',
                ($event.target as HTMLSelectElement).value || undefined,
              )
            "
          >
            <option value="">{{ t.button.inheritFont }}</option>
            <option
              v-for="font in fontFamilies"
              :key="font.value"
              :value="font.value"
            >
              {{ font.label }}
            </option>
          </select>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.button.text }}</label>
          <MergeTagInput
            :model-value="(block as ButtonBlock).text"
            type="text"
            @update:model-value="updateField('text', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.button.url }}</label>
          <MergeTagInput
            :model-value="(block as ButtonBlock).url"
            type="url"
            :placeholder="t.button.urlPlaceholder"
            @update:model-value="updateField('url', $event)"
          />
          <label
            v-if="(block as ButtonBlock).url"
            class="tpl:mt-2 tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
          >
            <input
              type="checkbox"
              class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
              :checked="(block as ButtonBlock).openInNewTab ?? false"
              @change="
                updateField(
                  'openInNewTab',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            {{ t.button.openInNewTab }}
          </label>
        </div>
        <div class="tpl:grid tpl:grid-cols-2 tpl:gap-3">
          <div class="tpl:mb-3.5">
            <label :class="labelClass">{{ t.button.background }}</label>
            <ColorPicker
              :model-value="(block as ButtonBlock).backgroundColor"
              @update:model-value="updateField('backgroundColor', $event)"
            />
          </div>
          <div class="tpl:mb-3.5">
            <label :class="labelClass">{{ t.button.textColor }}</label>
            <ColorPicker
              :model-value="(block as ButtonBlock).textColor"
              @update:model-value="updateField('textColor', $event)"
            />
          </div>
        </div>
        <div class="tpl:grid tpl:grid-cols-2 tpl:gap-3">
          <div class="tpl:mb-3.5">
            <label :class="labelClass">{{ t.button.borderRadius }}</label>
            <div class="tpl:flex tpl:items-stretch">
              <input
                type="number"
                :class="inputGroupInputClass"
                :value="(block as ButtonBlock).borderRadius"
                min="0"
                max="50"
                @input="
                  updateField(
                    'borderRadius',
                    Number(($event.target as HTMLInputElement).value),
                  )
                "
              />
              <span :class="inputSuffixClass">px</span>
            </div>
          </div>
          <div class="tpl:mb-3.5">
            <label :class="labelClass">{{ t.button.fontSize }}</label>
            <div class="tpl:flex tpl:items-stretch">
              <input
                type="number"
                :class="inputGroupInputClass"
                :value="(block as ButtonBlock).fontSize"
                min="10"
                max="36"
                @input="
                  updateField(
                    'fontSize',
                    Number(($event.target as HTMLInputElement).value),
                  )
                "
              />
              <span :class="inputSuffixClass">px</span>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="blockType === 'divider'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.divider.style }}</label>
          <SlidingPillSelect
            :options="[
              { value: 'solid', label: t.divider.solid },
              { value: 'dashed', label: t.divider.dashed },
              { value: 'dotted', label: t.divider.dotted },
            ]"
            :model-value="(block as DividerBlock).lineStyle"
            @update:model-value="updateField('lineStyle', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.divider.color }}</label>
          <ColorPicker
            :model-value="(block as DividerBlock).color"
            @update:model-value="updateField('color', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.divider.thickness }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="(block as DividerBlock).thickness"
              min="1"
              max="10"
              @input="
                updateField(
                  'thickness',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
      </template>

      <template v-else-if="blockType === 'social'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.social.icons }}</label>
          <div class="tpl:flex tpl:flex-col tpl:gap-2">
            <div
              v-for="icon in (block as SocialIconsBlock).icons"
              :key="icon.id"
              class="tpl:flex tpl:flex-col tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:p-2"
            >
              <div class="tpl:flex tpl:items-center tpl:gap-2">
                <select
                  :class="inputClass"
                  class="tpl:flex-1"
                  :value="icon.platform"
                  @change="
                    updateSocialIcon(
                      icon.id,
                      'platform',
                      ($event.target as HTMLSelectElement)
                        .value as SocialPlatform,
                    )
                  "
                >
                  <option
                    v-for="platform in socialPlatformOptions"
                    :key="platform"
                    :value="platform"
                  >
                    {{ socialIcons[platform].name }}
                  </option>
                </select>
                <button
                  class="tpl:flex tpl:size-8 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-danger)] tpl:hover:bg-[var(--tpl-danger-light)] tpl:hover:text-[var(--tpl-danger)]"
                  :title="t.social.removeIcon"
                  @click="removeSocialIcon(icon.id)"
                >
                  <X :size="14" :stroke-width="2" />
                </button>
              </div>
              <MergeTagInput
                :model-value="icon.url"
                type="url"
                :placeholder="t.social.urlPlaceholder"
                @update:model-value="updateSocialIcon(icon.id, 'url', $event)"
              />
            </div>
            <button
              class="tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-dashed tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-primary)] tpl:hover:text-[var(--tpl-primary)]"
              @click="addSocialIcon"
            >
              <Plus :size="14" :stroke-width="2" />
              {{ t.social.addIcon }}
            </button>
          </div>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.social.style }}</label>
          <SlidingPillSelect
            :options="[
              { value: 'solid', label: t.social.styleSolid },
              { value: 'outlined', label: t.social.styleOutlined },
              { value: 'rounded', label: t.social.styleRounded },
              { value: 'square', label: t.social.styleSquare },
              { value: 'circle', label: t.social.styleCircle },
            ]"
            :model-value="(block as SocialIconsBlock).iconStyle"
            @update:model-value="updateField('iconStyle', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.social.size }}</label>
          <SlidingPillSelect
            :options="[
              { value: 'small', label: t.social.sizeSmall },
              { value: 'medium', label: t.social.sizeMedium },
              { value: 'large', label: t.social.sizeLarge },
            ]"
            :model-value="(block as SocialIconsBlock).iconSize"
            @update:model-value="updateField('iconSize', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.social.spacing }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="(block as SocialIconsBlock).spacing"
              min="0"
              max="50"
              @input="
                updateField(
                  'spacing',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.social.align }}</label>
          <SlidingPillSelect
            :options="[
              {
                value: 'left',
                label: t.text.alignLeft,
                icon: AlignLeft,
              },
              {
                value: 'center',
                label: t.text.alignCenter,
                icon: AlignCenter,
              },
              {
                value: 'right',
                label: t.text.alignRight,
                icon: AlignRight,
              },
            ]"
            :model-value="(block as SocialIconsBlock).align"
            @update:model-value="updateField('align', $event)"
          />
        </div>
      </template>

      <template v-else-if="blockType === 'menu'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.menu.items }}</label>
          <div class="tpl:flex tpl:flex-col tpl:gap-2">
            <div
              v-for="item in (block as MenuBlock).items"
              :key="item.id"
              class="tpl:flex tpl:flex-col tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:p-2"
            >
              <div class="tpl:flex tpl:items-center tpl:gap-2">
                <input
                  type="text"
                  :class="inputClass"
                  class="tpl:flex-1"
                  :value="item.text"
                  :placeholder="t.menu.text"
                  @input="
                    updateMenuItem(
                      item.id,
                      'text',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
                <button
                  class="tpl:flex tpl:size-8 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-danger)] tpl:hover:bg-[var(--tpl-danger-light)] tpl:hover:text-[var(--tpl-danger)]"
                  :title="t.menu.removeItem"
                  @click="removeMenuItem(item.id)"
                >
                  <X :size="14" :stroke-width="2" />
                </button>
              </div>
              <MergeTagInput
                :model-value="item.url"
                type="url"
                :placeholder="t.menu.urlPlaceholder"
                @update:model-value="updateMenuItem(item.id, 'url', $event)"
              />
              <div
                class="tpl:flex tpl:items-center tpl:gap-3 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
              >
                <label
                  class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1"
                  ><input
                    type="checkbox"
                    :checked="item.openInNewTab"
                    class="tpl:accent-[var(--tpl-primary)]"
                    @change="
                      updateMenuItem(
                        item.id,
                        'openInNewTab',
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  {{ t.menu.openInNewTab }}</label
                >
                <label
                  class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1"
                  ><input
                    type="checkbox"
                    :checked="item.bold"
                    class="tpl:accent-[var(--tpl-primary)]"
                    @change="
                      updateMenuItem(
                        item.id,
                        'bold',
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  {{ t.menu.bold }}</label
                >
                <label
                  class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1"
                  ><input
                    type="checkbox"
                    :checked="item.underline"
                    class="tpl:accent-[var(--tpl-primary)]"
                    @change="
                      updateMenuItem(
                        item.id,
                        'underline',
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  {{ t.menu.underline }}</label
                >
              </div>
              <div class="tpl:flex tpl:items-center tpl:gap-2">
                <label class="tpl:text-xs tpl:text-[var(--tpl-text-muted)]">{{
                  t.menu.color
                }}</label>
                <ColorPicker
                  swatch-only
                  :model-value="
                    item.color ||
                    (block as MenuBlock).linkColor ||
                    (block as MenuBlock).color
                  "
                  @update:model-value="updateMenuItem(item.id, 'color', $event)"
                />
              </div>
            </div>
            <button
              class="tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-dashed tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-primary)] tpl:hover:text-[var(--tpl-primary)]"
              @click="addMenuItem"
            >
              <Plus :size="14" :stroke-width="2" />
              {{ t.menu.addItem }}
            </button>
          </div>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.menu.fontFamily }}</label>
          <select
            :class="inputClass"
            :value="(block as MenuBlock).fontFamily || ''"
            @change="
              updateField(
                'fontFamily',
                ($event.target as HTMLSelectElement).value || undefined,
              )
            "
          >
            <option value="">{{ t.text.inheritFont }}</option>
            <option
              v-for="font in fontFamilies"
              :key="font.value"
              :value="font.value"
            >
              {{ font.label }}
            </option>
          </select>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.menu.fontSize }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="(block as MenuBlock).fontSize"
              min="8"
              max="48"
              @input="
                updateField(
                  'fontSize',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.menu.color }}</label>
          <ColorPicker
            :model-value="(block as MenuBlock).color"
            @update:model-value="updateField('color', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.menu.linkColor }}</label>
          <ColorPicker
            :model-value="
              (block as MenuBlock).linkColor || (block as MenuBlock).color
            "
            @update:model-value="updateField('linkColor', $event || undefined)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.menu.textAlign }}</label>
          <SlidingPillSelect
            :options="[
              {
                value: 'left',
                label: t.text.alignLeft,
                icon: AlignLeft,
              },
              {
                value: 'center',
                label: t.text.alignCenter,
                icon: AlignCenter,
              },
              {
                value: 'right',
                label: t.text.alignRight,
                icon: AlignRight,
              },
            ]"
            :model-value="(block as MenuBlock).textAlign"
            @update:model-value="updateField('textAlign', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.menu.separator }}</label>
          <input
            type="text"
            :class="inputClass"
            :value="(block as MenuBlock).separator"
            @input="
              updateField(
                'separator',
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.menu.separatorColor }}</label>
          <ColorPicker
            :model-value="(block as MenuBlock).separatorColor"
            @update:model-value="updateField('separatorColor', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.menu.spacing }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="(block as MenuBlock).spacing"
              min="0"
              max="50"
              @input="
                updateField(
                  'spacing',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
      </template>

      <template v-else-if="blockType === 'table'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.table.dimensions }}</label>
          <div class="tpl:flex tpl:items-center tpl:gap-3">
            <div class="tpl:flex tpl:flex-1 tpl:items-center tpl:gap-1.5">
              <span class="tpl:text-xs tpl:text-[var(--tpl-text-muted)]">{{
                t.table.rows
              }}</span>
              <div
                class="tpl:flex tpl:items-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)]"
              >
                <button
                  class="tpl:flex tpl:items-center tpl:justify-center tpl:px-1.5 tpl:py-1 tpl:text-[var(--tpl-text-muted)] tpl:transition-colors tpl:duration-150 tpl:hover:text-[var(--tpl-primary)] tpl:disabled:opacity-30"
                  :disabled="(block as TableBlock).rows.length <= 1"
                  @click="
                    removeTableRow(
                      (block as TableBlock).rows[
                        (block as TableBlock).rows.length - 1
                      ].id,
                    )
                  "
                >
                  <Minus :size="12" :stroke-width="2" />
                </button>
                <span
                  class="tpl:min-w-[20px] tpl:text-center tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]"
                  >{{ (block as TableBlock).rows.length }}</span
                >
                <button
                  class="tpl:flex tpl:items-center tpl:justify-center tpl:px-1.5 tpl:py-1 tpl:text-[var(--tpl-text-muted)] tpl:transition-colors tpl:duration-150 tpl:hover:text-[var(--tpl-primary)]"
                  @click="addTableRow"
                >
                  <Plus :size="12" :stroke-width="2" />
                </button>
              </div>
            </div>
            <div class="tpl:flex tpl:flex-1 tpl:items-center tpl:gap-1.5">
              <span class="tpl:text-xs tpl:text-[var(--tpl-text-muted)]">{{
                t.table.columns
              }}</span>
              <div
                class="tpl:flex tpl:items-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)]"
              >
                <button
                  class="tpl:flex tpl:items-center tpl:justify-center tpl:px-1.5 tpl:py-1 tpl:text-[var(--tpl-text-muted)] tpl:transition-colors tpl:duration-150 tpl:hover:text-[var(--tpl-primary)] tpl:disabled:opacity-30"
                  :disabled="tableColumnCount <= 1"
                  @click="removeTableColumn(tableColumnCount - 1)"
                >
                  <Minus :size="12" :stroke-width="2" />
                </button>
                <span
                  class="tpl:min-w-[20px] tpl:text-center tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]"
                  >{{ tableColumnCount }}</span
                >
                <button
                  class="tpl:flex tpl:items-center tpl:justify-center tpl:px-1.5 tpl:py-1 tpl:text-[var(--tpl-text-muted)] tpl:transition-colors tpl:duration-150 tpl:hover:text-[var(--tpl-primary)]"
                  @click="addTableColumn"
                >
                  <Plus :size="12" :stroke-width="2" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="tpl:mb-3.5">
          <label
            class="tpl:mb-1.5 tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
          >
            <input
              type="checkbox"
              :checked="(block as TableBlock).hasHeaderRow"
              class="tpl:accent-[var(--tpl-primary)]"
              @change="
                updateField(
                  'hasHeaderRow',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            {{ t.table.hasHeaderRow }}
          </label>
        </div>
        <div v-if="(block as TableBlock).hasHeaderRow" class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.table.headerBackgroundColor }}</label>
          <ColorPicker
            :model-value="
              (block as TableBlock).headerBackgroundColor || '#f2f2f2'
            "
            :placeholder="t.table.noHeaderBg"
            @update:model-value="
              updateField('headerBackgroundColor', $event || null)
            "
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.table.borderColor }}</label>
          <ColorPicker
            :model-value="(block as TableBlock).borderColor"
            @update:model-value="updateField('borderColor', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.table.borderWidth }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="(block as TableBlock).borderWidth"
              min="0"
              max="10"
              @input="
                updateField(
                  'borderWidth',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.table.cellPadding }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="(block as TableBlock).cellPadding"
              min="0"
              max="30"
              @input="
                updateField(
                  'cellPadding',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.table.fontFamily }}</label>
          <select
            :class="inputClass"
            :value="(block as TableBlock).fontFamily || ''"
            @change="
              updateField(
                'fontFamily',
                ($event.target as HTMLSelectElement).value || undefined,
              )
            "
          >
            <option value="">{{ t.text.inheritFont }}</option>
            <option
              v-for="font in fontFamilies"
              :key="font.value"
              :value="font.value"
            >
              {{ font.label }}
            </option>
          </select>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.table.fontSize }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="(block as TableBlock).fontSize"
              min="10"
              max="32"
              @input="
                updateField(
                  'fontSize',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.table.color }}</label>
          <ColorPicker
            :model-value="(block as TableBlock).color"
            @update:model-value="updateField('color', $event)"
          />
        </div>
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.table.textAlign }}</label>
          <SlidingPillSelect
            :options="[
              {
                value: 'left',
                label: t.text.alignLeft,
                icon: AlignLeft,
              },
              {
                value: 'center',
                label: t.text.alignCenter,
                icon: AlignCenter,
              },
              {
                value: 'right',
                label: t.text.alignRight,
                icon: AlignRight,
              },
            ]"
            :model-value="(block as TableBlock).textAlign"
            @update:model-value="updateField('textAlign', $event)"
          />
        </div>
      </template>

      <template v-else-if="blockType === 'spacer'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.spacer.height }}</label>
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="(block as SpacerBlock).height"
              min="10"
              max="100"
              @input="
                updateField(
                  'height',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
          <input
            type="range"
            class="tpl:mt-2 tpl:w-full tpl:accent-[var(--tpl-primary)]"
            :value="(block as SpacerBlock).height"
            min="10"
            max="100"
            @input="
              updateField(
                'height',
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
      </template>

      <template v-else-if="blockType === 'html'">
        <div class="tpl:mb-3.5">
          <label :class="labelClass">{{ t.html.content }}</label>
          <textarea
            :value="(block as HtmlBlock).content"
            :placeholder="'<div>...</div>'"
            rows="10"
            class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2.5 tpl:py-2 tpl:font-mono tpl:text-xs tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:outline-none tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
            @input="
              updateField(
                'content',
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />
          <p
            class="tpl:mt-1.5 tpl:flex tpl:items-start tpl:gap-1.5 tpl:text-[11px] tpl:text-[var(--tpl-text-dim)]"
          >
            <Info :size="12" class="tpl:mt-0.5 tpl:shrink-0" />
            {{ t.html.sanitizationHint }}
          </p>
        </div>
      </template>

      <!-- Common block settings -->
      <div class="tpl:mt-4 tpl:flex tpl:flex-col">
        <!-- Spacing -->
        <div class="tpl:border-t tpl:border-[var(--tpl-border)] tpl:py-3">
          <button
            type="button"
            class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
            @click="spacingOpen = !spacingOpen"
          >
            <ChevronDown
              class="tpl:transition-transform tpl:duration-200"
              :class="spacingOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
              :size="12"
              :stroke-width="2"
            />
            <span>{{ t.blockSettings.spacing }}</span>
          </button>
          <div v-show="spacingOpen" class="tpl:mt-3">
            <SpacingControl
              :label="t.blockSettings.padding"
              :model-value="block.styles.padding"
              @update:model-value="updateStyle('padding', $event)"
            />
            <div class="tpl:mt-4">
              <SpacingControl
                :label="t.blockSettings.margin"
                :model-value="block.styles.margin"
                @update:model-value="updateStyle('margin', $event)"
              />
            </div>
          </div>
        </div>

        <!-- Background -->
        <div class="tpl:border-t tpl:border-[var(--tpl-border)] tpl:py-3">
          <button
            type="button"
            class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
            @click="bgOpen = !bgOpen"
          >
            <ChevronDown
              class="tpl:transition-transform tpl:duration-200"
              :class="bgOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
              :size="12"
              :stroke-width="2"
            />
            <span>{{ t.blockSettings.background }}</span>
          </button>
          <div v-show="bgOpen" class="tpl:mt-3">
            <label :class="labelClass">{{ t.blockSettings.color }}</label>
            <ColorPicker
              size="large"
              :model-value="block.styles.backgroundColor || '#ffffff'"
              @update:model-value="updateStyle('backgroundColor', $event)"
            />
          </div>
        </div>

        <!-- Display -->
        <div class="tpl:border-t tpl:border-[var(--tpl-border)] tpl:py-3">
          <button
            type="button"
            class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
            @click="displayOpen = !displayOpen"
          >
            <ChevronDown
              class="tpl:transition-transform tpl:duration-200"
              :class="displayOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
              :size="12"
              :stroke-width="2"
            />
            <span>{{ t.blockSettings.display }}</span>
          </button>
          <div v-show="displayOpen" class="tpl:mt-3 tpl:space-y-2">
            <label
              class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text)]"
            >
              <input
                type="checkbox"
                class="tpl:accent-[var(--tpl-primary)]"
                :checked="block.visibility?.desktop !== false"
                @change="
                  emit('update', {
                    visibility: {
                      desktop:
                        block.visibility?.desktop !== false ? false : true,
                      tablet: block.visibility?.tablet !== false,
                      mobile: block.visibility?.mobile !== false,
                    },
                  })
                "
              />
              <Monitor :size="14" :stroke-width="1.5" />
              {{ t.blockSettings.showOnDesktop }}
            </label>
            <label
              class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text)]"
            >
              <input
                type="checkbox"
                class="tpl:accent-[var(--tpl-primary)]"
                :checked="block.visibility?.tablet !== false"
                @change="
                  emit('update', {
                    visibility: {
                      desktop: block.visibility?.desktop !== false,
                      tablet: block.visibility?.tablet !== false ? false : true,
                      mobile: block.visibility?.mobile !== false,
                    },
                  })
                "
              />
              <Tablet :size="14" :stroke-width="1.5" />
              {{ t.blockSettings.showOnTablet }}
            </label>
            <label
              class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text)]"
            >
              <input
                type="checkbox"
                class="tpl:accent-[var(--tpl-primary)]"
                :checked="block.visibility?.mobile !== false"
                @change="
                  emit('update', {
                    visibility: {
                      desktop: block.visibility?.desktop !== false,
                      tablet: block.visibility?.tablet !== false,
                      mobile: block.visibility?.mobile !== false ? false : true,
                    },
                  })
                "
              />
              <Smartphone :size="14" :stroke-width="1.5" />
              {{ t.blockSettings.showOnMobile }}
            </label>
          </div>
        </div>

        <!-- Custom CSS -->
        <div class="tpl:border-t tpl:border-[var(--tpl-border)] tpl:py-3">
          <button
            type="button"
            class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
            @click="cssOpen = !cssOpen"
          >
            <ChevronDown
              class="tpl:transition-transform tpl:duration-200"
              :class="cssOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
              :size="12"
              :stroke-width="2"
            />
            <span>{{ t.blockSettings.customCss }}</span>
          </button>
          <div v-show="cssOpen" class="tpl:mt-3">
            <label :class="labelClass">{{ t.blockSettings.css }}</label>
            <textarea
              :value="block.customCss || ''"
              :placeholder="t.blockSettings.cssPlaceholder"
              rows="3"
              class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2.5 tpl:py-2 tpl:font-mono tpl:text-xs tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:outline-none tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
              @input="
                emit('update', {
                  customCss: ($event.target as HTMLTextAreaElement).value,
                })
              "
            />
          </div>
        </div>

        <!-- Display Conditions -->
        <div
          v-if="hasDisplayConditions"
          class="tpl:border-t tpl:border-[var(--tpl-border)] tpl:py-3"
        >
          <button
            type="button"
            class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
            @click="conditionOpen = !conditionOpen"
          >
            <ChevronDown
              class="tpl:transition-transform tpl:duration-200"
              :class="conditionOpen ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
              :size="12"
              :stroke-width="2"
            />
            <span>{{ t.blockSettings.displayCondition }}</span>
          </button>
          <div v-show="conditionOpen" class="tpl:mt-3 tpl:space-y-2">
            <select
              class="tpl:w-full tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-2 tpl:text-xs tpl:outline-none tpl:transition-all tpl:duration-150 tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
              :class="
                block.displayCondition
                  ? 'tpl:border-[var(--tpl-primary)] tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-text)]'
                  : 'tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]'
              "
              :value="
                customConditionMode || isCustomCondition
                  ? '__custom__'
                  : (block.displayCondition?.label ?? '')
              "
              @change="
                (e: Event) => {
                  const label = (e.target as HTMLSelectElement).value;
                  if (label === '__custom__') {
                    startCustomCondition();
                    return;
                  }
                  customConditionMode = false;
                  if (!label) {
                    emit('update', { displayCondition: undefined });
                    return;
                  }
                  const condition = displayConditions.find(
                    (c) => c.label === label,
                  );
                  if (condition) {
                    emit('update', { displayCondition: condition });
                  }
                }
              "
            >
              <option value="">{{ t.blockSettings.noCondition }}</option>
              <template
                v-for="(conditions, group) in groupedDisplayConditions"
                :key="group"
              >
                <optgroup v-if="group" :label="String(group)">
                  <option
                    v-for="condition in conditions"
                    :key="condition.label"
                    :value="condition.label"
                  >
                    {{ condition.label }}
                  </option>
                </optgroup>
                <template v-else>
                  <option
                    v-for="condition in conditions"
                    :key="condition.label"
                    :value="condition.label"
                  >
                    {{ condition.label }}
                  </option>
                </template>
              </template>
              <option v-if="allowCustomConditions" value="__custom__">
                {{ t.blockSettings.customCondition }}
              </option>
            </select>

            <!-- Custom condition fields -->
            <template v-if="customConditionMode || isCustomCondition">
              <div class="tpl:space-y-2">
                <div>
                  <label
                    class="tpl:mb-1 tpl:block tpl:text-[11px] tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
                    >{{ t.blockSettings.customConditionBefore }}</label
                  >
                  <textarea
                    v-model="customBefore"
                    rows="2"
                    class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2.5 tpl:py-2 tpl:font-mono tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none tpl:transition-all tpl:duration-150 tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
                  />
                </div>
                <div>
                  <label
                    class="tpl:mb-1 tpl:block tpl:text-[11px] tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
                    >{{ t.blockSettings.customConditionAfter }}</label
                  >
                  <textarea
                    v-model="customAfter"
                    rows="2"
                    class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2.5 tpl:py-2 tpl:font-mono tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none tpl:transition-all tpl:duration-150 tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
                  />
                </div>
                <div class="tpl:flex tpl:justify-end">
                  <button
                    type="button"
                    class="tpl:cursor-pointer tpl:rounded-md tpl:border-none tpl:bg-[var(--tpl-primary)] tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:text-white tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:opacity-50"
                    :disabled="!customBefore.trim()"
                    @click="applyCustomCondition"
                  >
                    {{ t.blockSettings.applyCondition }}
                  </button>
                </div>
              </div>
            </template>

            <!-- Preset condition details -->
            <template v-else-if="block.displayCondition && !isCustomCondition">
              <p
                v-if="block.displayCondition.description"
                class="tpl:text-[11px] tpl:text-[var(--tpl-text-muted)]"
              >
                {{ block.displayCondition.description }}
              </p>
              <div class="tpl:space-y-1">
                <pre
                  class="tpl:m-0 tpl:overflow-x-auto tpl:rounded tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:font-mono tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
                  >{{ block.displayCondition.before }}</pre
                >
                <pre
                  v-if="block.displayCondition.after"
                  class="tpl:m-0 tpl:overflow-x-auto tpl:rounded tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:font-mono tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
                  >{{ block.displayCondition.after }}</pre
                >
              </div>
            </template>
          </div>
        </div>
      </div>
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
