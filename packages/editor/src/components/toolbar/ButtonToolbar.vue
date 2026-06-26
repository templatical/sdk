<script setup lang="ts">
import { computed } from "vue";
import ColorPicker from "../ColorPicker.vue";
import MergeTagInput from "../MergeTagInput.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../../constants/styleConstants";
import type { ButtonBlock } from "@templatical/types";

const props = defineProps<{
  block: ButtonBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ButtonBlock>): void;
}>();

const { t } = useI18n();

const DEFAULT_CUSTOM_WIDTH = 200;

const widthMode = computed<"auto" | "full" | "custom">(() => {
  if (props.block.width === "full") return "full";
  if (typeof props.block.width === "number") return "custom";
  return "auto";
});

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

function updateCustomWidth(raw: string): void {
  // Guard against empty / NaN / non-positive input. An empty number field
  // yields Number("") === 0, which would emit width: 0 and render a 0px
  // button (#260). Ignore invalid values and keep the last valid width;
  // the canvas still updates live on each valid keystroke.
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return;
  updateField("width", n);
}
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.button.fontFamily }}</label>
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
      :model-value="block.text"
      type="text"
      @update:model-value="updateField('text', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.button.url }}</label>
    <MergeTagInput
      :model-value="block.url"
      type="url"
      :placeholder="t.button.urlPlaceholder"
      @update:model-value="updateField('url', $event)"
    />
    <label
      v-if="block.url"
      class="tpl:mt-2 tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
    >
      <input
        type="checkbox"
        class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
        :checked="block.openInNewTab ?? false"
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
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.button.background }}</label>
    <ColorPicker
      :model-value="block.backgroundColor"
      @update:model-value="updateField('backgroundColor', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.button.textColor }}</label>
    <ColorPicker
      :model-value="block.textColor"
      @update:model-value="updateField('textColor', $event)"
    />
  </div>
  <div class="tpl:grid tpl:grid-cols-2 tpl:gap-3">
    <div class="tpl:mb-3.5">
      <label :class="labelClass">{{ t.button.borderRadius }}</label>
      <div class="tpl:flex tpl:items-stretch">
        <input
          type="number"
          :class="inputGroupInputClass"
          :value="block.borderRadius"
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
    </div>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.button.width }}</label>
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
      class="tpl:mt-2 tpl:flex tpl:items-stretch"
    >
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="
          typeof block.width === 'number' ? block.width : DEFAULT_CUSTOM_WIDTH
        "
        min="20"
        @input="updateCustomWidth(($event.target as HTMLInputElement).value)"
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </div>
</template>
