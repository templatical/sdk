<script setup lang="ts">
/**
 * Floating bar for an active pick session: how many blocks are picked, plus
 * Save and Cancel.
 *
 * Positioned like `EditorFooter` — absolute inside `.tpl`, NOT inside the
 * canvas body, whose `overflow: auto` would clip it. The rail offsets are the
 * non-preview ones because a session can't be active in preview mode
 * (`useSavedBlocksFeature` cancels it if preview turns on).
 */
import { useI18n } from "../composables";
import { Bookmark, X } from "@lucide/vue";

const props = defineProps<{
  count: number;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const { t, format } = useI18n();

function handleConfirm(): void {
  if (props.count > 0) emit("confirm");
}
</script>

<template>
  <div
    data-testid="saved-blocks-pick-bar"
    class="tpl:absolute tpl:bottom-10 tpl:left-12 tpl:right-[320px] tpl:z-50 tpl:flex tpl:justify-center tpl:px-4"
    style="pointer-events: none"
  >
    <div
      role="toolbar"
      :aria-label="t.savedBlocks.pickToolbar"
      class="tpl-scale-in tpl:flex tpl:items-center tpl:gap-3 tpl:rounded-[var(--tpl-radius-lg)] tpl:border tpl:py-2 tpl:pl-4 tpl:pr-2 tpl:border-[var(--tpl-border)]"
      style="
        pointer-events: auto;
        background-color: var(--tpl-bg-elevated);
        box-shadow: var(--tpl-shadow-xl);
      "
    >
      <div class="tpl:flex tpl:flex-col">
        <span
          data-testid="saved-blocks-pick-count"
          class="tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text)]"
        >
          {{ format(t.savedBlocks.pickCount, { count }) }}
        </span>
        <span class="tpl:text-[11px] tpl:text-[var(--tpl-text-dim)]">
          {{ t.savedBlocks.pickHint }}
        </span>
      </div>

      <div class="tpl:flex tpl:items-center tpl:gap-1.5">
        <button
          type="button"
          data-testid="saved-blocks-pick-cancel"
          class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1 tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-150 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)]"
          @click="emit('cancel')"
        >
          <X :size="13" :stroke-width="2" />
          {{ t.savedBlocks.cancel }}
        </button>
        <button
          type="button"
          data-testid="saved-blocks-pick-confirm"
          class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1 tpl:rounded-md tpl:px-2.5 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50 tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
          :disabled="count === 0"
          @click="handleConfirm"
        >
          <Bookmark :size="13" :stroke-width="2" />
          {{ t.savedBlocks.save }}
        </button>
      </div>
    </div>
  </div>
</template>
