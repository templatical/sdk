<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../../constants/styleConstants";
import type { DividerBlock } from "@templatical/types";

defineProps<{
  block: DividerBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<DividerBlock>): void;
}>();

const { t } = useI18n();

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<DividerBlock>);
}
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.divider.style }}</label>
    <SlidingPillSelect
      :options="[
        { value: 'solid', label: t.divider.solid },
        { value: 'dashed', label: t.divider.dashed },
        { value: 'dotted', label: t.divider.dotted },
      ]"
      :model-value="block.lineStyle"
      @update:model-value="updateField('lineStyle', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.divider.color }}</label>
    <ColorPicker
      :model-value="block.color"
      @update:model-value="updateField('color', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.divider.thickness }}</label>
    <div class="tpl:flex tpl:items-stretch">
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="block.thickness"
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
