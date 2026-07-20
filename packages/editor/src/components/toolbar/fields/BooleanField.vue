<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockBooleanField } from "@templatical/types";
import { Lock } from "@lucide/vue";
import ToggleSwitch from "../../ToggleSwitch.vue";

defineProps<{
  field: CustomBlockBooleanField;
  modelValue: boolean;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="tpl:mb-3.5"
    :title="readOnly ? t.customBlocks.dataSource.readOnlyTooltip : undefined"
  >
    <ToggleSwitch
      class="tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
      :model-value="modelValue"
      :label="field.label"
      :required="field.required"
      :disabled="readOnly"
      @update:model-value="emit('update:modelValue', $event)"
    >
      {{ field.label }}
      <Lock
        v-if="readOnly"
        :size="12"
        class="tpl:inline tpl:text-[var(--tpl-text-dim)]"
      />
    </ToggleSwitch>
  </div>
</template>
