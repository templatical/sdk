<script setup lang="ts">
import { computed } from "vue";
import { useTheme } from "@/composables/useTheme";
import Icon from "../shared/Icon.vue";

const { mode, toggle } = useTheme();
const isDark = computed(() => mode.value === "dark");
</script>

<template>
  <button
    type="button"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :aria-pressed="isDark"
    class="relative inline-flex size-11 items-center justify-center overflow-hidden rounded-md border border-border bg-bg-elevated text-text-muted transition-colors duration-150 hover:bg-bg-hover hover:text-text active:bg-bg-active"
    @click="toggle"
  >
    <Transition name="icon-swap" mode="out-in">
      <Icon
        :key="isDark ? 'sun' : 'moon'"
        :name="isDark ? 'sun' : 'moon'"
        :size="16"
        aria-hidden="true"
      />
    </Transition>
  </button>
</template>
