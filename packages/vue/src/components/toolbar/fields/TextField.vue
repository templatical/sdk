<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockTextField } from "@templatical/types";
import { inputClass, labelClass } from "../../../constants/styleConstants";
import { Lock } from "lucide-vue-next";

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
      v-if="readOnly"
      type="text"
      :class="[inputClass, 'tpl:opacity-60 tpl:cursor-not-allowed']"
      :value="modelValue"
      :placeholder="field.placeholder"
      disabled
      :title="t.customBlocks.dataSource.readOnlyTooltip"
    />
    <input
      v-else
      type="text"
      :class="inputClass"
      :value="modelValue"
      :placeholder="field.placeholder"
      @input="
        emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    />
  </div>
</template>
