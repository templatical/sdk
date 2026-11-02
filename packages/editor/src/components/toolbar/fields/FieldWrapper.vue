<script setup lang="ts">
import { labelClass } from "../../../constants/styleConstants";
import FieldLabel from "./FieldLabel.vue";

defineProps<{
  label: string;
  hideLabel?: boolean;
  required?: boolean;
  readOnly?: boolean;
}>();
</script>

<template>
  <div class="tpl:mb-3.5">
    <label v-if="!hideLabel" :class="labelClass">
      <FieldLabel :label="label" :required="required" :read-only="readOnly" />
    </label>
    <slot />
  </div>
</template>
