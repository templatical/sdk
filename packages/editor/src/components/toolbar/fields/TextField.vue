<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockTextField } from "@templatical/types";
import { inputClass } from "../../../constants/styleConstants";
import FieldWrapper from "./FieldWrapper.vue";
import MergeTagInput from "../../MergeTagInput.vue";

defineProps<{
  field: CustomBlockTextField;
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
    <input
      v-if="readOnly"
      type="text"
      :class="[inputClass, 'tpl:opacity-60 tpl:cursor-not-allowed']"
      :value="modelValue"
      :placeholder="field.placeholder"
      disabled
      :title="t.customBlocks.dataSource.readOnlyTooltip"
    />
    <MergeTagInput
      v-else
      :model-value="modelValue"
      :placeholder="field.placeholder"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </FieldWrapper>
</template>
