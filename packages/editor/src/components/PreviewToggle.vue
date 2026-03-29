<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { Eye, EyeOff } from "lucide-vue-next";

defineProps<{
  previewMode: boolean;
}>();

const emit = defineEmits<{
  (e: "change", previewMode: boolean): void;
}>();

const { t } = useI18n();
</script>

<template>
  <button
    class="tpl-preview-toggle tpl:relative tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:p-2 tpl:transition-all tpl:duration-150"
    :style="{
      color: previewMode ? 'var(--tpl-primary)' : 'var(--tpl-text-muted)',
      backgroundColor: previewMode ? 'var(--tpl-primary-light)' : 'transparent',
    }"
    :title="previewMode ? t.previewMode.disable : t.previewMode.enable"
    @click="emit('change', !previewMode)"
  >
    <Transition
      enter-active-class="tpl-icon-enter-active"
      leave-active-class="tpl-icon-leave-active"
      enter-from-class="tpl-icon-enter-from"
      leave-to-class="tpl-icon-leave-to"
      mode="out-in"
    >
      <Eye v-if="previewMode" key="eye" :size="18" :stroke-width="1.5" />
      <EyeOff v-else key="eye-off" :size="18" :stroke-width="1.5" />
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

.tpl-preview-toggle:hover {
  background-color: var(--tpl-bg-hover);
}

.tpl-preview-toggle:active {
  transform: scale(0.92);
}
</style>
