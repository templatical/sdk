<script setup lang="ts">
import { computed } from "vue";
import { Check, CircleAlert } from "@lucide/vue";
import { useI18n } from "../composables/useI18n";

/*
 * Rendered only when a templates provider can actually save: without one
 * the editor never learns that a save completed, so this would read
 * "unsaved" forever.
 *
 * One element in every state, with an icon slot that keeps its width even
 * while empty. The header measures this slot and never the words
 * (`useHeaderFit`), so a save cannot move the header in or out of its
 * compact layout; the words show only where the full header has room for
 * them, and are otherwise visually hidden but still read. One persistent
 * node is also what lets a live region announce the change. The glyph
 * differs per state (dot, check, alert), so the state never rests on
 * colour alone when the words are hidden.
 */
const props = defineProps<{
  status: "idle" | "saved" | "error";
  /** The provider's failure message, shown in a tooltip on the error state. */
  errorMessage: string;
  isDirty: boolean;
}>();

const { t } = useI18n();

/** Priority order: a failure needs acknowledging, a fresh success outranks the
 *  dirty flag, and "unsaved" is the resting state once either decays. */
const state = computed<"error" | "saved" | "unsaved" | "none">(() => {
  if (props.status === "error") return "error";
  if (props.status === "saved") return "saved";
  return props.isDirty ? "unsaved" : "none";
});

const LABEL_KEYS = {
  error: "saveFailed",
  saved: "saved",
  unsaved: "unsaved",
} as const;

/** Read only while there is a state to name. */
const label = computed(() =>
  state.value === "none" ? "" : t.header[LABEL_KEYS[state.value]],
);

const colorClass = computed(() => {
  if (state.value === "error") return "tpl:text-[var(--tpl-danger)]";
  if (state.value === "saved") return "tpl:text-[var(--tpl-success)]";
  return "tpl:text-[var(--tpl-text-muted)]";
});
</script>

<template>
  <div
    :aria-live="state === 'error' ? 'assertive' : 'polite'"
    :data-testid="state === 'none' ? undefined : `save-status-${state}`"
    :title="state === 'saved' || state === 'unsaved' ? label : undefined"
    :data-tooltip="state === 'error' ? errorMessage : undefined"
    class="tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs"
    :class="[colorClass, { 'tpl-tooltip': state === 'error' }]"
  >
    <span
      class="tpl-status-icon tpl:inline-flex tpl:size-3 tpl:shrink-0 tpl:items-center tpl:justify-center"
      :class="{ 'tpl:invisible': state === 'none' }"
      aria-hidden="true"
    >
      <CircleAlert v-if="state === 'error'" :size="12" :stroke-width="2.5" />
      <Check v-else-if="state === 'saved'" :size="12" :stroke-width="2.5" />
      <span
        v-else-if="state === 'unsaved'"
        class="tpl-pulse tpl:size-1.5 tpl:rounded-full tpl:bg-[var(--tpl-primary)]"
      ></span>
    </span>
    <span v-if="state !== 'none'" class="tpl-status-label">{{ label }}</span>
  </div>
</template>
