<script setup lang="ts">
import { ghostBtnClass, primaryBtnClass } from "../constants/styleConstants";
/**
 * Shown while a past version is on the canvas instead of the user's own work.
 * Cancel puts the pre-preview content back; Restore makes the version current.
 *
 * Lives outside `src/cloud/` because version history is a BYO provider, not a
 * Cloud feature — a consumer's own `versionHistory` provider drives this banner
 * with no Cloud involved.
 */
import { Clock } from "@lucide/vue";
import { useI18n } from "../composables/useI18n";

defineProps<{
  visible: boolean;
  /**
   * Whether the provider supplied `restore`. When it didn't, history is
   * browse-and-preview only, so the confirm action does not render at all
   * rather than rendering disabled — the same discipline saved blocks uses.
   */
  canRestore: boolean;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "confirm"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="visible"
    class="tpl-preview-banner tpl:absolute tpl:top-14 tpl:right-0 tpl:left-0 tpl:z-40 tpl:flex tpl:items-center tpl:justify-center tpl:gap-4 tpl:px-4 tpl:py-3 tpl:bg-[var(--tpl-primary-light)] tpl:border-b tpl:border-[var(--tpl-primary)]"
    data-testid="version-preview-banner"
    role="status"
  >
    <div
      class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:text-[var(--tpl-text)]"
    >
      <Clock
        :size="18"
        :stroke-width="2"
        class="tpl:text-[var(--tpl-primary)]"
      />
      <span>{{ t.versionPreview.message }}</span>
    </div>
    <div class="tpl:flex tpl:items-center tpl:gap-2">
      <button
        :class="ghostBtnClass"
        style="background-color: transparent"
        data-testid="version-preview-cancel"
        @click="emit('cancel')"
      >
        {{ t.versionPreview.cancel }}
      </button>
      <button
        v-if="canRestore"
        :class="primaryBtnClass"
        data-testid="version-preview-restore"
        @click="emit('confirm')"
      >
        {{ t.versionPreview.restore }}
      </button>
    </div>
  </div>
</template>
