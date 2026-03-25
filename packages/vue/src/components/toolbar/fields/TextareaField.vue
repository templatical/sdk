<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockTextareaField } from "@templatical/types";
import { labelClass } from "../../../constants/styleConstants";
import { Lock } from "lucide-vue-next";

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

const editableTextareaClass =
  "tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:text-sm tpl:text-[var(--tpl-text)] tpl:outline-none tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)]";
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
    <textarea
      v-if="readOnly"
      :value="modelValue"
      :placeholder="field.placeholder"
      rows="3"
      disabled
      :title="t.customBlocks.dataSource.readOnlyTooltip"
      :class="readOnlyTextareaClass"
    />
    <textarea
      v-else
      :value="modelValue"
      :placeholder="field.placeholder"
      rows="3"
      :class="editableTextareaClass"
      @input="
        emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
      "
    />
  </div>
</template>
