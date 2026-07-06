<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../../constants/styleConstants";
import ColorPicker from "../ColorPicker.vue";
import SpacingControl from "../SpacingControl.vue";
import type {
  ColumnLayout,
  SectionBlock,
  SectionWrapper,
  SpacingValue,
} from "@templatical/types";
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

function handleBorderRadiusChange(event: Event): void {
  const borderRadius = Number((event.target as HTMLInputElement).value);
  emit("update", { borderRadius });
}

function setWrapperEnabled(enabled: boolean): void {
  emit("update", {
    wrapper: enabled
      ? { padding: { top: 20, right: 20, bottom: 20, left: 20 } }
      : undefined,
  });
}

function updateWrapper(patch: Partial<SectionWrapper>): void {
  emit("update", { wrapper: { ...props.block.wrapper, ...patch } });
}

function handleWrapperPadding(value: SpacingValue): void {
  updateWrapper({ padding: value });
}

function handleWrapperRadius(event: Event): void {
  updateWrapper({
    borderRadius: Number((event.target as HTMLInputElement).value),
  });
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
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.section.borderRadius }}</label>
    <div class="tpl:flex tpl:items-stretch">
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="block.borderRadius ?? 0"
        min="0"
        max="50"
        @input="handleBorderRadiusChange"
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </div>
  <div class="tpl:mb-3.5">
    <label
      class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text)]"
    >
      <input
        type="checkbox"
        class="tpl:accent-[var(--tpl-primary)]"
        :checked="!!block.wrapper"
        @change="setWrapperEnabled(($event.target as HTMLInputElement).checked)"
      />
      {{ t.section.wrapperEnable }}
    </label>
    <div
      v-if="block.wrapper"
      class="tpl:mt-3 tpl:ml-0.5 tpl:space-y-3 tpl:border-l tpl:border-[var(--tpl-border)] tpl:pl-3"
    >
      <div>
        <label :class="labelClass">{{ t.blockSettings.color }}</label>
        <ColorPicker
          :model-value="block.wrapper.backgroundColor ?? ''"
          @update:model-value="updateWrapper({ backgroundColor: $event })"
        />
      </div>
      <SpacingControl
        :label="t.blockSettings.padding"
        :model-value="
          block.wrapper.padding ?? { top: 0, right: 0, bottom: 0, left: 0 }
        "
        @update:model-value="handleWrapperPadding"
      />
      <div>
        <label :class="labelClass">{{ t.section.borderRadius }}</label>
        <div class="tpl:flex tpl:items-stretch">
          <input
            type="number"
            :class="inputGroupInputClass"
            :value="block.wrapper.borderRadius ?? 0"
            min="0"
            max="50"
            @input="handleWrapperRadius"
          />
          <span :class="inputSuffixClass">px</span>
        </div>
      </div>
    </div>
  </div>
</template>
