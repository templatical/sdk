<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { inputClass, labelClass } from "../../constants/styleConstants";
import type { ColumnLayout, SectionBlock } from "@templatical/types";
import { computed } from "vue";
import { rebalanceColumnChildren } from "../../utils/rebalanceColumnChildren";

const props = defineProps<{
  block: SectionBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<SectionBlock>): void;
}>();

const { t } = useI18n();

const columnOptions = computed(() => [
  { value: "1" as ColumnLayout, label: t.section.column1 },
  { value: "2" as ColumnLayout, label: t.section.column2 },
  { value: "3" as ColumnLayout, label: t.section.column3 },
  { value: "1-2" as ColumnLayout, label: t.section.ratio12 },
  { value: "2-1" as ColumnLayout, label: t.section.ratio21 },
]);

function handleColumnsChange(event: Event): void {
  const columns = (event.target as HTMLSelectElement).value as ColumnLayout;
  const children = rebalanceColumnChildren(props.block.children, columns);
  emit("update", { columns, children });
}
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.section.columns }}</label>
    <select
      :class="inputClass"
      :value="block.columns"
      @change="handleColumnsChange"
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
