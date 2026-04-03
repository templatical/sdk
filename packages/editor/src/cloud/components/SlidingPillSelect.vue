<script setup lang="ts">
import type { Component } from "vue";
import { computed } from "vue";

export interface PillOption {
  value: string;
  label: string;
  icon?: Component;
}

const props = defineProps<{
  options: PillOption[];
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const pillOffset = computed(() => {
  const index = props.options.findIndex((o) => o.value === props.modelValue);
  return `translateX(${Math.max(index, 0) * 100}%)`;
});
</script>

<template>
  <div
    role="radiogroup"
    class="tpl:relative tpl:grid tpl:rounded-[var(--tpl-radius-sm)] tpl:p-1"
    :style="{
      gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      backgroundColor: 'var(--tpl-bg-hover)',
    }"
  >
    <!-- Sliding pill -->
    <div
      class="tpl:absolute tpl:inset-y-1 tpl:rounded-[var(--tpl-radius-sm)]"
      :style="{
        left: '4px',
        width: `calc((100% - 8px) / ${options.length})`,
        transform: pillOffset,
        backgroundColor: 'var(--tpl-bg)',
        boxShadow: 'var(--tpl-shadow)',
        transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
      }"
    ></div>

    <button
      v-for="option in options"
      :key="option.value"
      role="radio"
      :aria-checked="modelValue === option.value"
      :aria-label="option.label"
      class="tpl:relative tpl:z-10 tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:px-2.5 tpl:py-[5px] tpl:text-xs tpl:font-medium"
      :style="{
        color:
          modelValue === option.value
            ? 'var(--tpl-primary)'
            : 'var(--tpl-text-muted)',
        transition: 'color 120ms cubic-bezier(0.16, 1, 0.3, 1)',
      }"
      :title="option.label"
      @click="emit('update:modelValue', option.value)"
    >
      <component
        :is="option.icon"
        v-if="option.icon"
        :size="14"
        :stroke-width="2"
      />
      <span v-else>{{ option.label }}</span>
    </button>
  </div>
</template>
