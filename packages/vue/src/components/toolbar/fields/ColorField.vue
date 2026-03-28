<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockColorField } from "@templatical/types";
import { labelClass } from "../../../constants/styleConstants";
import { Lock } from "lucide-vue-next";
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
    <ColorPicker
      :model-value="modelValue || '#000000'"
      :placeholder="field.placeholder || '#000000'"
      :disabled="readOnly"
      :title="readOnly ? t.customBlocks.dataSource.readOnlyTooltip : undefined"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>
