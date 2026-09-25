<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { inputClass, labelClass } from "../../constants/styleConstants";
import ColorPicker from "../ColorPicker.vue";
import SpacingControl from "../SpacingControl.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import BorderControl from "./BorderControl.vue";
import RadiusControl from "./RadiusControl.vue";
import {
  layoutWrapsSlot,
  type BorderRadiusValue,
  type ColumnLayout,
  type SectionBlock,
  type SectionWrapper,
  type SpacingValue,
} from "@templatical/types";
import { computed, inject } from "vue";
import { LAYOUT_KEY, SECTION_WRAPPER_KEY } from "../../keys";
import { rebalanceColumnChildren } from "../../utils/rebalanceColumnChildren";

const props = defineProps<{
  block: SectionBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<SectionBlock>): void;
}>();

const { t } = useI18n();

const layout = inject(LAYOUT_KEY, undefined);
const sectionWrapper = inject(SECTION_WRAPPER_KEY, undefined);

const wrapsSlot = layout !== undefined && layoutWrapsSlot(layout);

const showWrapperPanel = computed(
  () => sectionWrapper !== false || !!props.block.wrapper,
);
const disableTurnOn = computed(() => wrapsSlot && !props.block.wrapper);
const showNote = computed(() => wrapsSlot && showWrapperPanel.value);

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

function handleStackOnMobileChange(checked: boolean): void {
  emit("update", { stackOnMobile: checked });
}

function handleBorderRadiusChange(borderRadius: BorderRadiusValue): void {
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

function handleWrapperRadius(borderRadius: BorderRadiusValue): void {
  updateWrapper({ borderRadius });
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
  <div v-if="block.columns !== '1'" class="tpl:mb-3.5">
    <ToggleSwitch
      class="tpl:text-xs tpl:text-[var(--tpl-text)]"
      :model-value="block.stackOnMobile !== false"
      :label="t.section.stackOnMobile"
      @update:model-value="handleStackOnMobileChange($event)"
    />
  </div>
  <RadiusControl
    :model-value="block.borderRadius"
    :label="t.section.borderRadius"
    :max="50"
    testid-prefix="section"
    @update:model-value="handleBorderRadiusChange"
  />
  <BorderControl
    :model-value="block.border"
    testid-prefix="section"
    @update:model-value="emit('update', { border: $event })"
  />
  <div v-if="showWrapperPanel" class="tpl:mb-3.5">
    <ToggleSwitch
      class="tpl:text-xs tpl:text-[var(--tpl-text)]"
      :model-value="!!block.wrapper"
      :label="t.section.wrapperEnable"
      :disabled="disableTurnOn"
      @update:model-value="setWrapperEnabled($event)"
    />
    <p
      v-if="showNote"
      class="tpl:mt-1.5 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
    >
      {{ t.section.wrapperLayoutConflict }}
    </p>
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
      <RadiusControl
        :model-value="block.wrapper.borderRadius"
        :label="t.section.borderRadius"
        :max="50"
        testid-prefix="section-wrapper"
        @update:model-value="handleWrapperRadius"
      />
    </div>
  </div>
</template>
