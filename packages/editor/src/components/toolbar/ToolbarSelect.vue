<script setup lang="ts">
import { computed } from "vue";

interface OptionItem {
  value: string;
  label: string;
}

const props = defineProps<{
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

const CSS_WIDE_KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);

// For font size, line height and letter spacing, `modelValue` is a
// browser-parsed CSS value (read through `element.style`), so it arrives
// normalized: "16.0px" as "16px", "1.50" as "1.5", no `!important`. That is
// what makes the exact match below safe. A CSS-wide keyword reads as unset;
// any other value the options don't list (15px from imported text, say) is
// listed first, so the select shows what's applied. The font select's value
// is raw (TipTap reads `font-family` as written), but `withCurrentFont`
// always lists it, so this fallback never adds it.
const boundValue = computed(() =>
  CSS_WIDE_KEYWORDS.has(props.modelValue) ? "" : props.modelValue,
);

const listedOptions = computed<readonly (string | OptionItem)[]>(() => {
  const value = boundValue.value;
  if (value === "" || props.options.some((opt) => optionValue(opt) === value)) {
    return props.options;
  }
  return [value, ...props.options];
});
</script>

<template>
  <select
    :class="[
      'tpl:h-8 tpl:cursor-pointer tpl:rounded tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2 tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[var(--tpl-ring)]',
      widthClass ?? 'tpl:w-20',
    ]"
    :value="boundValue"
    :aria-label="label"
    :title="label"
    @change="onChange"
  >
    <option value="">{{ placeholder ?? "" }}</option>
    <option
      v-for="opt in listedOptions"
      :key="optionValue(opt)"
      :value="optionValue(opt)"
    >
      {{ optionLabel(opt) }}
    </option>
  </select>
</template>
