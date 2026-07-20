<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  label?: string;
  disabled?: boolean;
  required?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();
</script>

<template>
  <label
    :class="[
      'tpl:flex tpl:items-center tpl:justify-between tpl:gap-2',
      disabled ? 'tpl:cursor-not-allowed' : 'tpl:cursor-pointer',
    ]"
  >
    <span v-if="$slots.default || label || required">
      <slot>{{ label }}</slot>
      <span v-if="required" class="tpl:text-[var(--tpl-danger)]"> *</span>
    </span>
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label"
      :disabled="disabled"
      :class="[
        'tpl:relative tpl:inline-flex tpl:h-5 tpl:w-9 tpl:shrink-0 tpl:rounded-full tpl:border-2 tpl:border-transparent tpl:transition-colors tpl:duration-200',
        modelValue
          ? 'tpl:bg-[var(--tpl-primary)]'
          : 'tpl:bg-[var(--tpl-border)]',
        disabled
          ? 'tpl:cursor-not-allowed tpl:opacity-60'
          : 'tpl:cursor-pointer',
      ]"
      @click="!disabled && emit('update:modelValue', !modelValue)"
    >
      <span
        class="tpl:pointer-events-none tpl:inline-block tpl:size-4 tpl:rounded-full tpl:bg-[var(--tpl-bg)] tpl:shadow tpl:transition-transform tpl:duration-200"
        :class="modelValue ? 'tpl:translate-x-4' : 'tpl:translate-x-0'"
      />
    </button>
  </label>
</template>
