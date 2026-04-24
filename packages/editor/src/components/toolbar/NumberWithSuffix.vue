<script setup lang="ts">
import {
  inputGroupInputClass,
  inputSuffixClass,
} from "../../constants/styleConstants";

defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  suffix: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
}>();
</script>

<template>
  <div class="tpl:flex tpl:items-stretch">
    <input
      type="number"
      :class="inputGroupInputClass"
      :value="modelValue"
      :min="min"
      :max="max"
      @input="
        emit(
          'update:modelValue',
          Number(($event.target as HTMLInputElement).value),
        )
      "
    />
    <span :class="inputSuffixClass">{{ suffix }}</span>
  </div>
</template>
