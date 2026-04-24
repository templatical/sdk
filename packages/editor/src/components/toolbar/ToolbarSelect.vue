<script setup lang="ts">
interface OptionItem {
  value: string;
  label: string;
}

defineProps<{
  modelValue: string;
  options: readonly (string | OptionItem)[];
  label: string;
  placeholder?: string;
  widthClass?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

function onChange(e: Event): void {
  emit("update:modelValue", (e.target as HTMLSelectElement).value);
}

function optionValue(opt: string | OptionItem): string {
  return typeof opt === "string" ? opt : opt.value;
}

function optionLabel(opt: string | OptionItem): string {
  return typeof opt === "string" ? opt : opt.label;
}
</script>

<template>
  <select
    :class="[
      'tpl:h-8 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none',
      widthClass ?? 'tpl:w-20',
    ]"
    :value="modelValue"
    :aria-label="label"
    :title="label"
    @change="onChange"
  >
    <option value="">{{ placeholder ?? "" }}</option>
    <option
      v-for="opt in options"
      :key="optionValue(opt)"
      :value="optionValue(opt)"
    >
      {{ optionLabel(opt) }}
    </option>
  </select>
</template>
