<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
import { computed, inject } from "vue";
import ColorPicker from "../ColorPicker.vue";
import MergeTagInput from "../MergeTagInput.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import BorderControl from "./BorderControl.vue";
import RadiusControl from "./RadiusControl.vue";
import { useLocalizedDisplay } from "../../composables/useLocalizedDisplay";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  LINE_HEIGHT_OPTIONS,
} from "../../constants/styleConstants";
import {
  BUTTON_LINE_HEIGHT,
  buttonLineHeight,
  parsePercentWidth,
} from "@templatical/types";
import type { ButtonBlock } from "@templatical/types";
import { EDITOR_KEY, LAYOUT_KEY } from "../../keys";
import { imageRoom } from "../../utils/imageRoom";
import { fontSelectValue } from "../../utils/withCurrentFont";

const props = defineProps<{
  block: ButtonBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ButtonBlock>): void;
}>();

const { t } = useI18n();
const editor = inject(EDITOR_KEY, null);
const localized = editor ? useLocalizedDisplay(editor) : null;
const layout = inject(LAYOUT_KEY, null);

const DEFAULT_CUSTOM_WIDTH = 200;

const widthMode = computed<"auto" | "full" | "custom">(() => {
  if (props.block.width === "full") return "full";
  if (typeof props.block.width === "number") return "custom";
  if (parsePercentWidth(props.block.width) !== null) return "custom";
  // A stored string that is not a usable percentage renders at label width
  // in the canvas and the email, so the select says Auto too.
  return "auto";
});

const widthUnit = computed(() =>
  parsePercentWidth(props.block.width) !== null ? "%" : "px",
);

const customWidthValue = computed(() => {
  if (typeof props.block.width === "number") return props.block.width;
  // Shown only for Custom, which is a number or a usable percentage.
  return String(props.block.width).slice(0, -1);
});

/** The px the button can span, the same room an image measures. */
const room = computed(() =>
  localized
    ? imageRoom(localized.content.value, props.block.id, layout ?? undefined)
    : null,
);

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<ButtonBlock>);
}

function updateWidthMode(mode: string): void {
  if (mode === "full") {
    updateField("width", "full");
    return;
  }
  if (mode === "custom") {
    updateField(
      "width",
      typeof props.block.width === "number"
        ? props.block.width
        : DEFAULT_CUSTOM_WIDTH,
    );
    return;
  }
  updateField("width", undefined);
}

const lineHeightValue = computed(() => String(buttonLineHeight(props.block)));

const lineHeightOptions = computed(() => {
  const current = lineHeightValue.value;
  if (LINE_HEIGHT_OPTIONS.includes(current)) return LINE_HEIGHT_OPTIONS;
  return [...LINE_HEIGHT_OPTIONS, current];
});

function updateLineHeight(raw: string): void {
  const value = Number(raw);
  // 1.2 is what an omitted field renders. Storing it would write the default
  // onto every button, so the control clears the field.
  updateField("lineHeight", value === BUTTON_LINE_HEIGHT ? undefined : value);
}

function updateFontWeight(value: string): void {
  // Bold is the weight an omitted field renders. Storing it would write the
  // default onto every button, so the control clears the field, as Auto
  // clears width.
  updateField("fontWeight", value === "bold" ? undefined : value);
}

function updateCustomWidth(raw: string): void {
  // Guard against empty / NaN / non-positive input. An empty number field
  // yields Number("") === 0, which would emit width: 0 and render a 0px
  // button (#260). Ignore invalid values and keep the last valid width;
  // the canvas still updates live on each valid keystroke.
  const n = Number(raw);
  if (widthUnit.value === "%") {
    // Integers from the field. A stored decimal such as "33.33%" is shown
    // as is and is not rewritten until the field holds a whole number.
    if (!Number.isInteger(n) || n < 1 || n > 100) return;
    updateField("width", `${n}%`);
    return;
  }
  if (!Number.isFinite(n) || n <= 0) return;
  updateField("width", n);
}

function updateWidthUnit(unit: string): void {
  if (unit === widthUnit.value) return;
  const width = props.block.width;
  const roomPx = room.value;
  if (unit === "%") {
    // Custom + px is a number. A percentage is already on this unit.
    const px = width as number;
    if (roomPx === null) {
      updateField("width", "50%");
      return;
    }
    const pct = Math.min(100, Math.max(1, Math.round((px / roomPx) * 100)));
    updateField("width", `${pct}%`);
    return;
  }
  // The other unit is px, so the stored width is a usable percentage.
  const pct = parsePercentWidth(width) as number;
  if (roomPx === null) {
    updateField("width", DEFAULT_CUSTOM_WIDTH);
    return;
  }
  updateField("width", Math.max(1, Math.round((roomPx * pct) / 100)));
}
</script>

<template>
  <FieldRow :label="t.button.fontFamily" class="tpl:mb-3.5" path="fontFamily">
    <select
      :class="inputClass"
      :value="fontSelectValue(block.fontFamily)"
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
  </FieldRow>
  <FieldRow :label="t.button.text" class="tpl:mb-3.5" path="text">
    <MergeTagInput
      :model-value="block.text"
      type="text"
      @update:model-value="updateField('text', $event)"
    />
  </FieldRow>
  <FieldRow :label="t.button.url" class="tpl:mb-3.5" path="url">
    <MergeTagInput
      :model-value="block.url"
      type="url"
      :placeholder="t.button.urlPlaceholder"
      @update:model-value="updateField('url', $event)"
    />
    <FieldRow
      v-if="block.url"
      path="openInNewTab"
      :label="t.button.openInNewTab"
      ><template #label-actions="{ controlId }"
        ><ToggleSwitch
          :control-id="controlId"
          hide-label
          class="tpl:mt-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
          :model-value="block.openInNewTab ?? false"
          :label="t.button.openInNewTab"
          @update:model-value="updateField('openInNewTab', $event)" /></template
    ></FieldRow>
  </FieldRow>
  <FieldRow
    :label="t.button.background"
    class="tpl:mb-3.5"
    path="backgroundColor"
  >
    <ColorPicker
      :model-value="block.backgroundColor"
      allow-transparent
      @update:model-value="updateField('backgroundColor', $event)"
    />
  </FieldRow>
  <FieldRow :label="t.button.textColor" class="tpl:mb-3.5" path="textColor">
    <ColorPicker
      :model-value="block.textColor"
      @update:model-value="updateField('textColor', $event)"
    />
  </FieldRow>
  <BorderControl
    path="border"
    :model-value="block.border"
    testid-prefix="button"
    @update:model-value="updateField('border', $event)"
  />
  <RadiusControl
    path="borderRadius"
    :model-value="block.borderRadius"
    :label="t.button.borderRadius"
    :max="50"
    testid-prefix="button"
    @update:model-value="updateField('borderRadius', $event)"
  />
  <FieldRow :label="t.button.fontSize" class="tpl:mb-3.5" path="fontSize">
    <div class="tpl:flex tpl:items-stretch">
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="block.fontSize"
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
  </FieldRow>
  <FieldRow :label="t.button.lineHeight" class="tpl:mb-3.5" path="lineHeight">
    <select
      :class="inputClass"
      :value="lineHeightValue"
      @change="updateLineHeight(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in lineHeightOptions" :key="option" :value="option">
        {{ option }}
      </option>
    </select>
  </FieldRow>
  <FieldRow :label="t.button.fontWeight" class="tpl:mb-3.5" path="fontWeight">
    <SlidingPillSelect
      :options="[
        { value: 'regular', label: t.button.fontWeightRegular },
        { value: 'medium', label: t.button.fontWeightMedium },
        { value: 'bold', label: t.button.fontWeightBold },
      ]"
      :model-value="block.fontWeight ?? 'bold'"
      @update:model-value="updateFontWeight"
    />
  </FieldRow>
  <FieldRow :label="t.button.width" class="tpl:mb-3.5" path="width">
    <select
      :class="inputClass"
      :value="widthMode"
      @change="updateWidthMode(($event.target as HTMLSelectElement).value)"
    >
      <option value="auto">{{ t.button.widthAuto }}</option>
      <option value="full">{{ t.button.fullWidth }}</option>
      <option value="custom">{{ t.button.widthCustom }}</option>
    </select>
    <div
      v-if="widthMode === 'custom'"
      class="tpl:mt-2 tpl:flex tpl:items-stretch tpl:gap-2"
    >
      <input
        type="number"
        :class="[inputClass, 'tpl:min-w-0 tpl:flex-1']"
        :value="customWidthValue"
        :min="widthUnit === '%' ? 1 : 20"
        :max="widthUnit === '%' ? 100 : undefined"
        @input="updateCustomWidth(($event.target as HTMLInputElement).value)"
      />
      <SlidingPillSelect
        class="tpl:w-24 tpl:shrink-0"
        :aria-label="t.button.widthUnit"
        :options="[
          { value: 'px', label: 'px' },
          { value: '%', label: '%' },
        ]"
        :model-value="widthUnit"
        @update:model-value="updateWidthUnit"
      />
    </div>
  </FieldRow>
  <FieldRow :label="t.title.align" class="tpl:mb-3.5" path="align">
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft },
        { value: 'center', label: t.title.alignCenter },
        { value: 'right', label: t.title.alignRight },
      ]"
      :model-value="block.align ?? 'center'"
      @update:model-value="updateField('align', $event)"
    />
  </FieldRow>
</template>
