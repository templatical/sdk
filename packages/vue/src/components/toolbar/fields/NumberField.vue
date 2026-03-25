<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockNumberField } from "@templatical/types";
import { inputClass, labelClass } from "../../../constants/styleConstants";
import { Lock } from "lucide-vue-next";

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
  <div class="tpl:mb-3.5">
    <label :class="labelClass">
      {{ field.label }}
      <Lock
        v-if="readOnly"
        :size="12"
        class="tpl:inline tpl:text-[var(--tpl-text-dim)]"
      />
      <span v-if="field.required" class="tpl:text-[var(--tpl-danger)]">
        *
      </span>
    </label>
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
  </div>
</template>
