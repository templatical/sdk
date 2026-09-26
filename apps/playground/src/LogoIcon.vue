<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
    /** Set when live text beside the mark already names the brand. */
    decorative?: boolean;
  }>(),
  {
    size: 32,
    decorative: false,
  },
);
</script>

<template>
  <img
    :width="size"
    :height="size"
    src="https://templatical.com/logo.svg"
    :alt="decorative ? '' : 'Templatical'"
  />
</template>
