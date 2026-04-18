<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
  }>(),
  {
    size: 32,
  },
);
</script>

<template>
  <img
    :width="size"
    :height="size"
    src="https://templatical.com/logo.svg"
    alt="Templatical"
  />
</template>
