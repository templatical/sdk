<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockSelectField } from "@templatical/types";
import { inputClass } from "../../../constants/styleConstants";
import FieldWrapper from "./FieldWrapper.vue";

defineProps<{
  field: CustomBlockSelectField;
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
    <select
      :class="[inputClass, readOnly && 'tpl:opacity-60 tpl:cursor-not-allowed']"
      :value="modelValue"
      :disabled="readOnly"
      :title="readOnly ? t.customBlocks.dataSource.readOnlyTooltip : undefined"
      @change="
        !readOnly &&
        emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option
        v-for="option in field.options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </FieldWrapper>
</template>
