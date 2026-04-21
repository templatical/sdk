<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  label: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();
</script>

<template>
  <label
    class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text)]"
  >
    <input
      type="checkbox"
      class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
      :checked="modelValue"
      @change="
        emit('update:modelValue', ($event.target as HTMLInputElement).checked)
      "
    />
    {{ label }}
  </label>
</template>
