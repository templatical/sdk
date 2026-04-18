<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
  DEFAULT_TABLE_ROW_BG,
} from "../../constants/styleConstants";
import type {
  TableBlock,
  TableCellData,
  TableRowData,
} from "@templatical/types";
import { generateId } from "@templatical/types";
import { AlignCenter, AlignLeft, AlignRight, Minus, Plus } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  block: TableBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<TableBlock>): void;
}>();

const { t } = useI18n();

const tableColumnCount = computed(() => {
  return props.block.rows.length > 0 ? props.block.rows[0].cells.length : 0;
});

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<TableBlock>);
}

function addTableRow(): void {
  const columnCount =
    props.block.rows.length > 0 ? props.block.rows[0].cells.length : 3;
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
  emit("update", { rows: [...props.block.rows, newRow] });
}

function removeTableRow(rowId: string): void {
  emit("update", {
    rows: props.block.rows.filter((row) => row.id !== rowId),
  });
}

function addTableColumn(): void {
  const updatedRows = props.block.rows.map((row) => ({
    ...row,
    cells: [...row.cells, { id: generateId(), content: "" } as TableCellData],
  }));
  emit("update", { rows: updatedRows });
}

function removeTableColumn(colIndex: number): void {
  const updatedRows = props.block.rows.map((row) => ({
    ...row,
    cells: row.cells.filter((_, i) => i !== colIndex),
  }));
  emit("update", { rows: updatedRows });
}
</script>

<template>
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
            :disabled="block.rows.length <= 1"
            @click="removeTableRow(block.rows[block.rows.length - 1].id)"
          >
            <Minus :size="12" :stroke-width="2" />
          </button>
          <span
            class="tpl:min-w-[20px] tpl:text-center tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]"
            >{{ block.rows.length }}</span
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
        :checked="block.hasHeaderRow"
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
  <div v-if="block.hasHeaderRow" class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.table.headerBackgroundColor }}</label>
    <ColorPicker
      :model-value="block.headerBackgroundColor || DEFAULT_TABLE_ROW_BG"
      :placeholder="t.table.noHeaderBg"
      @update:model-value="updateField('headerBackgroundColor', $event || null)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.table.borderColor }}</label>
    <ColorPicker
      :model-value="block.borderColor"
      @update:model-value="updateField('borderColor', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.table.borderWidth }}</label>
    <div class="tpl:flex tpl:items-stretch">
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="block.borderWidth"
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
        :value="block.cellPadding"
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
      :value="block.fontFamily || ''"
      @change="
        updateField(
          'fontFamily',
          ($event.target as HTMLSelectElement).value || undefined,
        )
      "
    >
      <option value="">{{ t.title.inheritFont }}</option>
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
        :value="block.fontSize"
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
      :model-value="block.color"
      @update:model-value="updateField('color', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.table.textAlign }}</label>
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft, icon: AlignLeft },
        { value: 'center', label: t.title.alignCenter, icon: AlignCenter },
        { value: 'right', label: t.title.alignRight, icon: AlignRight },
      ]"
      :model-value="block.textAlign"
      @update:model-value="updateField('textAlign', $event)"
    />
  </div>
</template>
