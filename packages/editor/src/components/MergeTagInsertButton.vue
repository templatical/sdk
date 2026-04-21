<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { ScanLine } from "@lucide/vue";

defineProps<{
  disabled?: boolean;
}>();

defineEmits<{
  (e: "insert"): void;
}>();

const { t } = useI18n();

const mergeTagBtnClass =
  "tpl:flex tpl:items-center tpl:justify-center tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-[120ms] hover:tpl:bg-[var(--tpl-primary-light)] hover:tpl:text-[var(--tpl-primary)] hover:tpl:border-[var(--tpl-primary)]";
</script>

<template>
  <button
    type="button"
    :class="[mergeTagBtnClass, 'tpl:mt-1.5']"
    :aria-label="t.mergeTag.insert"
    :title="t.mergeTag.insert"
    :disabled="disabled"
    @click="$emit('insert')"
  >
    <ScanLine :size="12" :stroke-width="2" />
    {{ t.mergeTag.insert }}
  </button>
</template>
