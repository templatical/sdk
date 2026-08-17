<script setup lang="ts">
import { Check, CircleAlert } from "@lucide/vue";
import { useI18n } from "../composables/useI18n";

defineProps<{
  status: "idle" | "saved" | "error";
  /** The provider's failure message, shown in a tooltip on the error state. */
  errorMessage: string;
  isDirty: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <!-- Three mutually exclusive states, in priority order: a failure outranks
       everything (it needs acknowledging), a fresh success outranks the dirty
       flag, and "unsaved" is the resting state once either decays. Rendered
       only when a templates provider can actually save — without one the editor
       never learns that a save completed, so this would read "unsaved" forever. -->
  <div
    v-if="status === 'error'"
    aria-live="assertive"
    data-testid="save-status-error"
    class="tpl-tooltip tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:text-[var(--tpl-danger)]"
    :data-tooltip="errorMessage"
  >
    <CircleAlert :size="12" :stroke-width="2.5" />
    {{ t.header.saveFailed }}
  </div>
  <div
    v-else-if="status === 'saved'"
    aria-live="polite"
    data-testid="save-status-saved"
    class="tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:text-[var(--tpl-success)]"
  >
    <Check :size="12" :stroke-width="2.5" />
    {{ t.header.saved }}
  </div>
  <div
    v-else-if="isDirty"
    aria-live="polite"
    data-testid="save-status-unsaved"
    class="tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
  >
    <span
      class="tpl-pulse tpl:size-1.5 tpl:rounded-full tpl:bg-[var(--tpl-primary)]"
    ></span>
    {{ t.header.unsaved }}
  </div>
</template>
