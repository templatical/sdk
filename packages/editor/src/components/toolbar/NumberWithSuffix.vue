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
  /**
   * `data-testid` for the `<input>`. A plain attribute on this component falls
   * through to the wrapping `<div>`, which is not the element a test reads a
   * value from.
   */
  testid?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
}>();

function onInput(event: Event): void {
  const el = event.target as HTMLInputElement;
  // A number input reports in-progress unparseable content as an EMPTY string
  // with `badInput` set, so `Number(el.value)` is 0 and indistinguishable from
  // a cleared field. Emitting here overwrites the real value with 0 before the
  // number being typed ever arrives. Typing "-" is the everyday case: measured
  // in Chrome, it fires `input` with value "" + badInput true, and only the
  // following "5" fires again with "-5". `min` does not help — it drives
  // constraint validation, not the reported value.
  if (el.validity?.badInput) return;
  emit("update:modelValue", Number(el.value));
}
</script>

<template>
  <div class="tpl:flex tpl:items-stretch">
    <input
      type="number"
      :data-testid="testid"
      :class="inputGroupInputClass"
      :value="modelValue"
      :min="min"
      :max="max"
      @input="onInput"
    />
    <span :class="inputSuffixClass">{{ suffix }}</span>
  </div>
</template>
