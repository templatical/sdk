<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockSelectField } from "@templatical/types";
import { inputClass, labelClass } from "../../../constants/styleConstants";
import { Lock } from "lucide-vue-next";

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
  </div>
</template>
