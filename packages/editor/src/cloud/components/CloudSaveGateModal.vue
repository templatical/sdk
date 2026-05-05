<script setup lang="ts">
import { AlertTriangle } from "@lucide/vue";
import { useCloudI18nStrict } from "../../composables/useCloudI18n";
import type { A11yIssue } from "../../composables/useAccessibilityLint";

defineProps<{
  open: boolean;
  issues: A11yIssue[];
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "confirm"): void;
}>();

const { t: cloudT } = useCloudI18nStrict();
</script>

<template>
  <Transition
    enter-active-class="tpl:transition-opacity tpl:duration-150"
    leave-active-class="tpl:transition-opacity tpl:duration-150"
    enter-from-class="tpl:opacity-0"
    leave-to-class="tpl:opacity-0"
  >
    <div
      v-if="open"
      role="dialog"
      aria-modal="true"
      :aria-label="cloudT.saveGate.title"
      class="tpl:fixed tpl:inset-0 tpl:z-50 tpl:flex tpl:items-center tpl:justify-center tpl:bg-black/40 tpl:p-6"
      @click.self="emit('cancel')"
    >
      <div
        class="tpl:flex tpl:max-h-[80vh] tpl:w-full tpl:max-w-md tpl:flex-col tpl:gap-4 tpl:rounded-lg tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:p-5 tpl:shadow-[var(--tpl-shadow-md)]"
      >
        <header class="tpl:flex tpl:items-center tpl:gap-2">
          <AlertTriangle
            :size="18"
            :stroke-width="2"
            class="tpl:text-[var(--tpl-warning)]"
          />
          <h2
            class="tpl:m-0 tpl:text-base tpl:font-semibold tpl:text-[var(--tpl-text)]"
          >
            {{ cloudT.saveGate.title }}
          </h2>
        </header>

        <p class="tpl:m-0 tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
          {{ cloudT.saveGate.body }}
        </p>

        <ul
          class="tpl:m-0 tpl:flex tpl:max-h-64 tpl:list-none tpl:flex-col tpl:gap-1.5 tpl:overflow-y-auto tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-2"
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
            class="tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]"
            @click="emit('cancel')"
          >
            {{ cloudT.saveGate.cancel }}
          </button>
          <button
            type="button"
            class="tpl:rounded-md tpl:bg-[var(--tpl-danger)] tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:text-white"
            @click="emit('confirm')"
          >
            {{ cloudT.saveGate.confirm }}
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>
