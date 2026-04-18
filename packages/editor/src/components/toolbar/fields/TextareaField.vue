<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockTextareaField } from "@templatical/types";
import FieldWrapper from "./FieldWrapper.vue";
import MergeTagTextarea from "../../MergeTagTextarea.vue";

defineProps<{
  field: CustomBlockTextareaField;
  modelValue: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();

const readOnlyTextareaClass =
  "tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:text-sm tpl:text-[var(--tpl-text)] tpl:outline-none tpl:opacity-60 tpl:cursor-not-allowed";
</script>

<template>
  <FieldWrapper
    :label="field.label"
    :required="field.required"
    :read-only="readOnly"
  >
    <textarea
      v-if="readOnly"
      :value="modelValue"
      :placeholder="field.placeholder"
      rows="3"
      disabled
      :title="t.customBlocks.dataSource.readOnlyTooltip"
      :class="readOnlyTextareaClass"
    />
    <MergeTagTextarea
      v-else
      :model-value="modelValue"
      :placeholder="field.placeholder"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </FieldWrapper>
</template>
