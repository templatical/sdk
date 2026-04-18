<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockColorField } from "@templatical/types";
import { DEFAULT_TEXT_COLOR } from "../../../constants/styleConstants";
import FieldWrapper from "./FieldWrapper.vue";
import ColorPicker from "../../ColorPicker.vue";

defineProps<{
  field: CustomBlockColorField;
  modelValue: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();
</script>

<template>
  <FieldWrapper
    :label="field.label"
    :required="field.required"
    :read-only="readOnly"
  >
    <ColorPicker
      :model-value="modelValue || DEFAULT_TEXT_COLOR"
      :placeholder="field.placeholder || DEFAULT_TEXT_COLOR"
      :disabled="readOnly"
      :title="readOnly ? t.customBlocks.dataSource.readOnlyTooltip : undefined"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </FieldWrapper>
</template>
