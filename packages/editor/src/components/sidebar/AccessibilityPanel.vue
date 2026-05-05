<script setup lang="ts">
import { computed, inject } from "vue";
import {
  Accessibility,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  Wrench,
} from "@lucide/vue";
import { useI18n } from "../../composables/useI18n";
import { ACCESSIBILITY_LINT_KEY, EDITOR_KEY } from "../../keys";
import type { A11yIssue } from "../../composables/useAccessibilityLint";

const { t, format } = useI18n();
const lint = inject(ACCESSIBILITY_LINT_KEY, null);
const editor = inject(EDITOR_KEY, null);

const errors = computed(() =>
  (lint?.issues.value ?? []).filter((i) => i.severity === "error"),
);
const warnings = computed(() =>
  (lint?.issues.value ?? []).filter((i) => i.severity === "warning"),
);
const infos = computed(() =>
  (lint?.issues.value ?? []).filter((i) => i.severity === "info"),
);

const totalCount = computed(
  () => errors.value.length + warnings.value.length + infos.value.length,
);

function jumpTo(issue: A11yIssue): void {
  if (!editor) return;
  if (issue.blockId) editor.selectBlock(issue.blockId);
}

function applyFix(issue: A11yIssue): void {
  lint?.applyFix(issue);
}
</script>

<template>
  <div class="tpl:flex tpl:flex-col tpl:gap-4 tpl:p-4">
    <header class="tpl:flex tpl:items-center tpl:gap-2">
      <Accessibility :size="16" :stroke-width="1.5" />
      <h3
        class="tpl:m-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
      >
        {{ t.accessibility.panelTitle }}
      </h3>
      <span
        v-if="totalCount > 0"
        class="tpl:ml-auto tpl:rounded-full tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-0.5 tpl:text-[11px] tpl:text-[var(--tpl-text-muted)]"
        :title="
          format(t.accessibility.issueCountTooltip, { count: totalCount })
        "
      >
        {{ totalCount }}
      </span>
    </header>

    <div
      v-if="!lint || lint.unavailable.value"
      class="tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
    >
      <!-- Quality package not available; render nothing visible beyond a hint. -->
    </div>

    <div
      v-else-if="totalCount === 0"
      class="tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-3 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
    >
      {{ t.accessibility.emptyState }}
    </div>

    <template v-else>
      <section
        v-for="group in [
          {
            key: 'errors',
            title: t.accessibility.groupErrors,
            icon: AlertCircle,
            items: errors,
            tone: 'tpl:text-[var(--tpl-danger)]',
          },
          {
            key: 'warnings',
            title: t.accessibility.groupWarnings,
            icon: AlertTriangle,
            items: warnings,
            tone: 'tpl:text-[var(--tpl-warning)]',
          },
          {
            key: 'info',
            title: t.accessibility.groupInfo,
            icon: Info,
            items: infos,
            tone: 'tpl:text-[var(--tpl-text-muted)]',
          },
        ]"
        :key="group.key"
      >
        <header
          v-if="group.items.length > 0"
          class="tpl:mb-2 tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-[11px] tpl:font-semibold tpl:uppercase tpl:tracking-wide"
          :class="group.tone"
        >
          <component :is="group.icon" :size="12" :stroke-width="2" />
          {{ group.title }}
          <span class="tpl:ml-auto tpl:font-normal tpl:opacity-70">
            {{ group.items.length }}
          </span>
        </header>
        <ul
          v-if="group.items.length > 0"
          class="tpl:m-0 tpl:mb-3 tpl:flex tpl:list-none tpl:flex-col tpl:gap-2 tpl:p-0"
        >
          <li
            v-for="issue in group.items"
            :key="`${issue.ruleId}-${issue.blockId ?? 'template'}`"
            class="tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-3"
          >
            <p class="tpl:m-0 tpl:mb-2 tpl:text-xs tpl:text-[var(--tpl-text)]">
              {{ issue.message }}
            </p>
            <p
              class="tpl:m-0 tpl:mb-2 tpl:font-mono tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
            >
              {{ issue.ruleId }}
            </p>
            <div class="tpl:flex tpl:gap-1.5">
              <button
                v-if="issue.blockId"
                type="button"
                class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-1 tpl:text-[11px] tpl:font-medium tpl:text-[var(--tpl-text)]"
                @click="jumpTo(issue)"
              >
                <ArrowRight :size="10" :stroke-width="2" />
                {{ t.accessibility.jump }}
              </button>
              <button
                v-if="issue.fix"
                type="button"
                class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded-md tpl:bg-[var(--tpl-primary)] tpl:px-2 tpl:py-1 tpl:text-[11px] tpl:font-medium tpl:text-white"
                :title="issue.fix.description"
                @click="applyFix(issue)"
              >
                <Wrench :size="10" :stroke-width="2" />
                {{ t.accessibility.fix }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
