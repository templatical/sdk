<script setup lang="ts">
import type { Component } from "vue";

defineProps<{
  icon: Component;
  label: string;
  active?: boolean;
  strokeWidth?: number;
  size?: number;
}>();
</script>

<template>
  <button
    type="button"
    class="tpl-text-toolbar-btn"
    :class="{ 'tpl-text-toolbar-btn--active': active }"
    :aria-label="label"
    :title="label"
    :aria-pressed="active ? 'true' : 'false'"
  >
    <component :is="icon" :size="size ?? 16" :stroke-width="strokeWidth ?? 2" />
  </button>
</template>
