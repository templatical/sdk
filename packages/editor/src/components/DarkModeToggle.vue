<!--
  Canvas Dark Mode Preview Toggle

  This toggle simulates how the email template will look when the recipient's
  email client uses dark mode (e.g. Gmail, Outlook, Apple Mail in dark theme).
  It applies a CSS filter (invert + hue-rotate) to the canvas area only.

  This is NOT the editor UI theme toggle. The editor UI theme (light/dark/auto)
  is controlled externally via the `uiTheme` config option or `editor.setTheme()`.
-->
<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { Moon, Sun } from "@lucide/vue";

defineProps<{
  darkMode: boolean;
}>();

const emit = defineEmits<{
  (e: "change", darkMode: boolean): void;
}>();

const { t } = useI18n();
</script>

<template>
  <button
    class="tpl-dark-mode-toggle tpl:relative tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:p-2 tpl:transition-all tpl:duration-150"
    :style="{
      color: darkMode ? 'var(--tpl-primary)' : 'var(--tpl-text-muted)',
      backgroundColor: darkMode ? 'var(--tpl-primary-light)' : 'transparent',
    }"
    :aria-label="darkMode ? t.darkMode.disable : t.darkMode.enable"
    :title="darkMode ? t.darkMode.disable : t.darkMode.enable"
    :aria-pressed="darkMode"
    @click="emit('change', !darkMode)"
  >
    <Transition
      enter-active-class="tpl-icon-enter-active"
      leave-active-class="tpl-icon-leave-active"
      enter-from-class="tpl-icon-enter-from"
      leave-to-class="tpl-icon-leave-to"
      mode="out-in"
    >
      <Moon v-if="darkMode" key="moon" :size="18" :stroke-width="1.5" />
      <Sun v-else key="sun" :size="18" :stroke-width="1.5" />
    </Transition>
  </button>
</template>

<style scoped>
.tpl-icon-enter-active,
.tpl-icon-leave-active {
  transition:
    opacity 120ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 120ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-icon-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.tpl-icon-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.tpl-dark-mode-toggle:hover {
  background-color: var(--tpl-bg-hover);
}

.tpl-dark-mode-toggle:active {
  transform: scale(0.92);
}
</style>
