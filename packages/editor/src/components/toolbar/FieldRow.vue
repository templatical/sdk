<script setup lang="ts">
import { labelClass } from "../../constants/styleConstants";

defineProps<{
  label?: string;
}>();
</script>

<template>
  <div class="tpl:mb-3.5">
    <label v-if="label" :class="labelClass">{{ label }}</label>
    <slot />
  </div>
</template>
