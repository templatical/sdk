<script setup lang="ts">
import { AlertTriangle } from "@lucide/vue";
import {
  dangerBtnClass,
  secondaryBtnClass,
} from "../../constants/styleConstants";
import TplModal from "../../components/TplModal.vue";
import { useCloudI18nStrict } from "../../composables/useCloudI18n";
import type { LintIssue } from "../../composables/useTemplateLint";

defineProps<{
  open: boolean;
  issues: LintIssue[];
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "confirm"): void;
}>();

const { t: cloudT } = useCloudI18nStrict();
</script>

<template>
  <TplModal :visible="open" @close="emit('cancel')">
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="tpl-save-gate-title"
      aria-describedby="tpl-save-gate-body"
      data-testid="cloud-save-gate-dialog"
      class="tpl:flex tpl:max-h-[80%] tpl:w-full tpl:max-w-md tpl:flex-col tpl:gap-4 tpl:overflow-y-auto tpl:rounded-[var(--tpl-radius-lg)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-5 tpl:shadow-[var(--tpl-shadow-lg)]"
    >
      <header class="tpl:flex tpl:items-center tpl:gap-2">
        <AlertTriangle
          :size="18"
          :stroke-width="2"
          class="tpl:text-[var(--tpl-warning)]"
        />
        <h2
          id="tpl-save-gate-title"
          class="tpl:m-0 tpl:text-base tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{ cloudT.saveGate.title }}
        </h2>
      </header>

      <p
        id="tpl-save-gate-body"
        class="tpl:m-0 tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
      >
        {{ cloudT.saveGate.body }}
      </p>

      <ul
        class="tpl:m-0 tpl:flex tpl:max-h-64 tpl:list-none tpl:flex-col tpl:gap-1.5 tpl:overflow-y-auto tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:p-2"
      >
        <li
          v-for="issue in issues"
          :key="`${issue.ruleId}-${issue.blockId ?? 'template'}`"
          class="tpl:flex tpl:flex-col tpl:gap-0.5 tpl:rounded tpl:px-2 tpl:py-1.5"
        >
          <span class="tpl:text-xs tpl:text-[var(--tpl-text)]">
            {{ issue.message }}
          </span>
          <span
            class="tpl:font-mono tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
          >
            {{ issue.ruleId }}
          </span>
        </li>
      </ul>

      <footer class="tpl:flex tpl:justify-end tpl:gap-2">
        <button
          type="button"
          data-testid="cloud-save-gate-cancel"
          :class="secondaryBtnClass"
          @click="emit('cancel')"
        >
          {{ cloudT.saveGate.cancel }}
        </button>
        <button
          type="button"
          data-testid="cloud-save-gate-confirm"
          :class="dangerBtnClass"
          @click="emit('confirm')"
        >
          {{ cloudT.saveGate.confirm }}
        </button>
      </footer>
    </div>
  </TplModal>
</template>
