<script setup lang="ts">
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

defineProps<{
  block: ButtonBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ButtonBlock>): void;
}>();

const { t } = useI18n();

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<ButtonBlock>);
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
  <div class="tpl:grid tpl:grid-cols-2 tpl:gap-3">
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
</template>
