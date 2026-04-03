<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockBooleanField } from "@templatical/types";
import { Lock } from "@lucide/vue";

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
    <label
      :class="[
        'tpl:flex tpl:items-center tpl:justify-between tpl:gap-2',
        readOnly ? 'tpl:cursor-not-allowed' : 'tpl:cursor-pointer',
      ]"
    >
      <span
        class="tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
      >
        {{ field.label }}
        <Lock
          v-if="readOnly"
          :size="12"
          class="tpl:inline tpl:text-[var(--tpl-text-dim)]"
        />
        <span v-if="field.required" class="tpl:text-[var(--tpl-danger)]">
          *
        </span>
      </span>
      <button
        type="button"
        role="switch"
        :aria-checked="modelValue"
        :aria-label="field.label"
        :class="[
          'tpl:relative tpl:inline-flex tpl:h-5 tpl:w-9 tpl:shrink-0 tpl:rounded-full tpl:border-2 tpl:border-transparent tpl:transition-colors tpl:duration-200',
          modelValue
            ? 'tpl:bg-[var(--tpl-primary)]'
            : 'tpl:bg-[var(--tpl-border)]',
          readOnly
            ? 'tpl:opacity-60 tpl:cursor-not-allowed'
            : 'tpl:cursor-pointer',
        ]"
        :disabled="readOnly"
        @click="!readOnly && emit('update:modelValue', !modelValue)"
      >
        <span
          class="tpl:pointer-events-none tpl:inline-block tpl:size-4 tpl:rounded-full tpl:bg-[var(--tpl-bg)] tpl:shadow tpl:transition-transform tpl:duration-200"
          :class="modelValue ? 'tpl:translate-x-4' : 'tpl:translate-x-0'"
        />
      </button>
    </label>
  </div>
</template>
