<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../../constants/styleConstants";
import ColorPicker from "../ColorPicker.vue";
import SpacingControl from "../SpacingControl.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import BackgroundImageControl from "./BackgroundImageControl.vue";
import BorderControl from "./BorderControl.vue";
import RadiusControl from "./RadiusControl.vue";
import {
  COLUMN_LAYOUT_PERCENTS,
  columnWidthsIssue,
  layoutWrapsSlot,
  resolveHero,
  roundHundredths,
  sectionColumnPercents,
  type BorderRadiusValue,
  type ColumnLayout,
  type SectionBlock,
  type SectionWrapper,
  type SpacingValue,
} from "@templatical/types";
import { computed, inject } from "vue";
import { LAYOUT_KEY, SECTION_WRAPPER_KEY } from "../../keys";
import { rebalanceColumnChildren } from "../../utils/rebalanceColumnChildren";
import {
  applySectionFullWidth,
  clearSectionWrapper,
} from "../../utils/sectionFullWidth";

const props = defineProps<{
  block: SectionBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<SectionBlock>): void;
}>();

const { t, format } = useI18n();

const layout = inject(LAYOUT_KEY, undefined);
const sectionWrapper = inject(SECTION_WRAPPER_KEY, undefined);

const wrapsSlot = layout !== undefined && layoutWrapsSlot(layout);

const showWrapperPanel = computed(
  () => sectionWrapper !== false || !!props.block.wrapper,
);
const disableTurnOn = computed(() => wrapsSlot && !props.block.wrapper);
const showNote = computed(() => wrapsSlot && showWrapperPanel.value);

// mj-hero draws no border: hidden while the hero applies, kept for when it doesn't.
const heroApplied = computed(() => resolveHero(props.block)?.applied === true);

const columnOptions = computed(() => [
  { value: "1" as ColumnLayout, label: t.section.column1 },
  { value: "2" as ColumnLayout, label: t.section.column2 },
  { value: "3" as ColumnLayout, label: t.section.column3 },
  { value: "4" as ColumnLayout, label: t.section.column4 },
  { value: "1-2" as ColumnLayout, label: t.section.ratio12 },
  { value: "2-1" as ColumnLayout, label: t.section.ratio21 },
  { value: "1-3" as ColumnLayout, label: t.section.ratio13 },
  { value: "3-1" as ColumnLayout, label: t.section.ratio31 },
  { value: "1-2-1" as ColumnLayout, label: t.section.ratio121 },
]);

const shownPercents = computed(() => sectionColumnPercents(props.block));
const hasCustomWidths = computed(
  () =>
    props.block.columnWidths !== undefined &&
    columnWidthsIssue(props.block) === null,
);
const columnsValue = computed(() =>
  hasCustomWidths.value ? "custom" : props.block.columns,
);

function handleColumnsChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value === "custom") return;
  const columns = value as ColumnLayout;
  const children = rebalanceColumnChildren(props.block.children, columns);
  emit("update", { columns, children, columnWidths: undefined });
}

/** Hundredths, towards zero. The argument is at most 5, so it is not an exponent. */
function floorHundredths(value: number): number {
  const shifted = Number(`${String(value)}e2`);
  return Number(`${Math.floor(shifted)}e-2`);
}

function commitColumnWidth(index: number, event: Event): void {
  const input = event.target as HTMLInputElement;
  const text = input.value.trim();
  const parsed = Number(text);
  const current = shownPercents.value;
  if (text === "" || !Number.isFinite(parsed)) {
    input.value = String(current[index]);
    return;
  }
  const next = current.slice();
  const neighbour = index === next.length - 1 ? index - 1 : index + 1;
  const pair = next[index]! + next[neighbour]!;
  // A pair under 10% cannot spare 5% on each side. Half the pair, in
  // hundredths, is the floor, and it never drops under 0.01.
  const floor = Math.max(0.01, floorHundredths(Math.min(5, pair / 2)));
  const clamped = Math.min(Math.max(parsed, floor), pair - floor);
  next[index] = roundHundredths(clamped);
  next[neighbour] = roundHundredths(pair - next[index]!);
  const preset = COLUMN_LAYOUT_PERCENTS[props.block.columns];
  // A known layout's preset has one share per column. An unknown layout has none.
  const matchesPreset =
    preset !== undefined &&
    preset.every((share, shareIndex) => share === next[shareIndex]);
  emit("update", { columnWidths: matchesPreset ? undefined : next });
}

function handleStackOnMobileChange(checked: boolean): void {
  emit("update", { stackOnMobile: checked });
}

function handleBorderRadiusChange(borderRadius: BorderRadiusValue): void {
  emit("update", { borderRadius });
}

function setWrapperEnabled(enabled: boolean): void {
  if (!enabled) {
    emit("update", clearSectionWrapper(props.block));
    return;
  }
  emit("update", {
    wrapper: { padding: { top: 20, right: 20, bottom: 20, left: 20 } },
  });
}

function setFullWidth(enabled: boolean): void {
  emit("update", applySectionFullWidth(props.block, enabled));
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
      :value="columnsValue"
      @change="handleColumnsChange"
    >
      <option
        v-for="option in columnOptions"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
      <option v-if="hasCustomWidths" value="custom">
        {{ t.section.columnsCustom }}
      </option>
    </select>
  </div>
  <FieldRow
    v-if="shownPercents.length > 1"
    path="columnWidths"
    :label="t.section.columnWidths"
  >
    <div class="tpl:flex tpl:gap-2">
      <div
        v-for="(percent, index) in shownPercents"
        :key="index"
        class="tpl:flex tpl:min-w-0 tpl:flex-1 tpl:items-stretch"
      >
        <input
          type="number"
          step="any"
          :class="inputGroupInputClass"
          :value="percent"
          :aria-label="format(t.section.columnWidthAria, { index: index + 1 })"
          @change="commitColumnWidth(index, $event)"
        />
        <span :class="inputSuffixClass">%</span>
      </div>
    </div>
  </FieldRow>
  <FieldRow
    v-if="block.columns !== '1'"
    class="tpl:mb-3.5"
    path="stackOnMobile"
    :label="t.section.stackOnMobile"
    ><template #label-actions="{ controlId }"
      ><ToggleSwitch
        :control-id="controlId"
        hide-label
        class="tpl:text-xs tpl:text-[var(--tpl-text)]"
        :model-value="block.stackOnMobile !== false"
        :label="t.section.stackOnMobile"
        @update:model-value="handleStackOnMobileChange($event)" /></template
  ></FieldRow>
  <RadiusControl
    path="borderRadius"
    :model-value="block.borderRadius"
    :label="t.section.borderRadius"
    :max="50"
    testid-prefix="section"
    @update:model-value="handleBorderRadiusChange"
  />
  <BorderControl
    path="border"
    v-if="!heroApplied"
    :model-value="block.border"
    testid-prefix="section"
    @update:model-value="emit('update', { border: $event })"
  />
  <div v-if="showWrapperPanel" class="tpl:mb-3.5">
    <FieldRow path="wrapper" :label="t.section.wrapperEnable"
      ><template #label-actions="{ controlId }"
        ><ToggleSwitch
          :control-id="controlId"
          hide-label
          class="tpl:text-xs tpl:text-[var(--tpl-text)]"
          :model-value="!!block.wrapper"
          :label="t.section.wrapperEnable"
          :disabled="disableTurnOn"
          @update:model-value="setWrapperEnabled($event)" /></template
    ></FieldRow>
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
      <FieldRow
        path="wrapper.fullWidth"
        :label="t.blockSettings.fullWidthBackground"
        ><template #label-actions="{ controlId }"
          ><ToggleSwitch
            data-testid="section-wrapper-full-width"
            :control-id="controlId"
            hide-label
            class="tpl:text-xs tpl:text-[var(--tpl-text)]"
            :model-value="block.wrapper.fullWidth === true"
            :label="t.blockSettings.fullWidthBackground"
            @update:model-value="setFullWidth" /></template
      ></FieldRow>
      <div>
        <FieldRow path="wrapper.backgroundColor" :label="t.blockSettings.color"
          ><ColorPicker
            :model-value="block.wrapper.backgroundColor ?? ''"
            allow-transparent
            @update:model-value="updateWrapper({ backgroundColor: $event })"
        /></FieldRow>
      </div>
      <FieldRow
        path="wrapper.backgroundImage"
        :label="t.blockSettings.backgroundImage"
        ><BackgroundImageControl
          hide-label
          :model-value="block.wrapper.backgroundImage"
          testid-prefix="section-wrapper"
          @update:model-value="updateWrapper({ backgroundImage: $event })"
      /></FieldRow>
      <SpacingControl
        path="wrapper.padding"
        :label="t.blockSettings.padding"
        :model-value="
          block.wrapper.padding ?? { top: 0, right: 0, bottom: 0, left: 0 }
        "
        @update:model-value="handleWrapperPadding"
      />
      <RadiusControl
        path="wrapper.borderRadius"
        :model-value="block.wrapper.borderRadius"
        :label="t.section.borderRadius"
        :max="50"
        testid-prefix="section-wrapper"
        @update:model-value="handleWrapperRadius"
      />
    </div>
  </div>
</template>
