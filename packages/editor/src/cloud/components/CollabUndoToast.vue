<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";

defineProps<{
  visible: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="visible"
    role="status"
    aria-live="polite"
    class="tpl:absolute tpl:top-16 tpl:left-1/2 tpl:z-toast tpl:-translate-x-1/2 tpl:rounded-[var(--tpl-radius)] tpl:px-4 tpl:py-2.5 tpl:text-sm tpl:shadow-lg"
    style="
      background-color: var(--tpl-warning-light);
      color: var(--tpl-text);
      border: 1px solid var(--tpl-warning);
    "
  >
    {{ t.history.collabWarning }}
  </div>
</template>
