<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { Braces } from "@lucide/vue";

defineProps<{
  disabled?: boolean;
}>();

defineEmits<{
  (e: "insert"): void;
}>();

const { t } = useI18n();

const logicBtnClass =
  "tpl:flex tpl:items-center tpl:justify-center tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-[120ms] tpl:hover:bg-[var(--tpl-primary-light)] tpl:hover:text-[var(--tpl-primary)] tpl:hover:border-[var(--tpl-primary)]";
</script>

<template>
  <button
    type="button"
    :class="[logicBtnClass, 'tpl:mt-1.5']"
    :aria-label="t.logicTag.insert"
    :title="t.logicTag.insert"
    :disabled="disabled"
    data-testid="field-insert-logic-button"
    @mousedown.prevent
    @click="$emit('insert')"
  >
    <Braces :size="12" :stroke-width="2" />
    {{ t.logicTag.insertShort }}
  </button>
</template>
