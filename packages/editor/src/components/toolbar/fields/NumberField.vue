<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockNumberField } from "@templatical/types";
import { inputClass } from "../../../constants/styleConstants";
import FieldWrapper from "./FieldWrapper.vue";

defineProps<{
  field: CustomBlockNumberField;
  modelValue: number;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
}>();

const { t } = useI18n();
</script>

<template>
  <FieldWrapper
    :label="field.label"
    :required="field.required"
    :read-only="readOnly"
  >
    <input
      type="number"
      :class="[inputClass, readOnly && 'tpl:opacity-60 tpl:cursor-not-allowed']"
      :value="modelValue"
      :placeholder="field.placeholder"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :disabled="readOnly"
      :title="readOnly ? t.customBlocks.dataSource.readOnlyTooltip : undefined"
      @input="
        !readOnly &&
        emit(
          'update:modelValue',
          Number(($event.target as HTMLInputElement).value),
        )
      "
    />
  </FieldWrapper>
</template>
