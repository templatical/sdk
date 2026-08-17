<script setup lang="ts">
/**
 * Confirms a restore that would discard unsaved work.
 *
 * It exists because `confirmRestore()` throws away the pre-preview backup: once
 * a restore lands, anything the user had not saved exists nowhere. The editor
 * does not record a version to cover that — it never authors versions — so the
 * protection is a question asked at the moment of loss, with the option to put
 * the work somewhere real first.
 *
 * `canSave` decides which of the two shapes renders: an offer to save first, or
 * a plain warning when the templates provider withheld `save` (or there is no
 * templates provider at all), because there is then nowhere to put the work.
 */
import { AlertTriangle, LoaderCircle } from "@lucide/vue";
import TplModal from "./TplModal.vue";
import { useI18n } from "../composables/useI18n";

defineProps<{
  visible: boolean;
  /** Whether "save first" can be offered rather than only a warning. */
  canSave: boolean;
  /** True while either action is in flight — both buttons go inert. */
  isBusy: boolean;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "save-and-restore"): void;
  (e: "discard-and-restore"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <TplModal :visible="visible" @close="emit('cancel')">
    <div
      role="alertdialog"
      aria-modal="true"
      :aria-busy="isBusy"
      aria-labelledby="tpl-restore-version-title"
      aria-describedby="tpl-restore-version-body"
      data-testid="restore-version-dialog"
      class="tpl-scale-in tpl:mx-4 tpl:flex tpl:w-full tpl:max-w-md tpl:flex-col tpl:gap-4 tpl:rounded-[var(--tpl-radius-lg)] tpl:p-5"
      style="
        background-color: var(--tpl-bg-elevated);
        box-shadow: var(--tpl-shadow-xl);
      "
    >
      <div class="tpl:flex tpl:items-center tpl:gap-2">
        <AlertTriangle
          :size="18"
          :stroke-width="2"
          class="tpl:text-[var(--tpl-warning)]"
        />
        <h3
          id="tpl-restore-version-title"
          class="tpl:m-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{ t.versionPreview.restoreConfirm.title }}
        </h3>
      </div>

      <p
        id="tpl-restore-version-body"
        class="tpl:m-0 tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
      >
        {{
          canSave
            ? t.versionPreview.restoreConfirm.unsavedWithSave
            : t.versionPreview.restoreConfirm.unsavedNoSave
        }}
      </p>

      <div class="tpl:flex tpl:justify-end tpl:gap-2">
        <button
          type="button"
          data-testid="restore-version-cancel"
          class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50 tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
          :disabled="isBusy"
          @click="emit('cancel')"
        >
          {{ t.versionPreview.restoreConfirm.cancel }}
        </button>
        <button
          type="button"
          data-testid="restore-version-discard"
          class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50 tpl:border-[var(--tpl-danger)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-danger)]"
          :disabled="isBusy"
          @click="emit('discard-and-restore')"
        >
          {{ t.versionPreview.restoreConfirm.restoreAnyway }}
        </button>
        <!-- Only rendered when there is somewhere to save to: an action the
             editor cannot perform should not look like one you could take. -->
        <button
          v-if="canSave"
          type="button"
          data-testid="restore-version-save-first"
          class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50 tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
          :disabled="isBusy"
          @click="emit('save-and-restore')"
        >
          <LoaderCircle
            v-if="isBusy"
            class="tpl:animate-spin"
            :size="12"
            :stroke-width="2"
          />
          {{ t.versionPreview.restoreConfirm.saveAndRestore }}
        </button>
      </div>
    </div>
  </TplModal>
</template>
