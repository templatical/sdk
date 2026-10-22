<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from "vue";
import {
  ListChecks,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  Wrench,
} from "@lucide/vue";
import { useI18n } from "../../composables/useI18n";
import { useScrollToBlock } from "../../composables/useScrollToBlock";
import {
  TEMPLATE_LINT_KEY,
  EDITOR_KEY,
  SIZE_CHECK_KEY,
  UI_LOCALE_KEY,
} from "../../keys";
import type { LintIssue } from "../../composables/useTemplateLint";

const { t, format } = useI18n();
const lint = inject(TEMPLATE_LINT_KEY, null);
const editor = inject(EDITOR_KEY, null);
const sizeCheck = inject(SIZE_CHECK_KEY, null);
const locale = inject(UI_LOCALE_KEY, "en");
const scrollToBlock = useScrollToBlock();

const sizeAvailable = computed(
  () =>
    !!sizeCheck &&
    !sizeCheck.cloud &&
    sizeCheck.canRenderHtml() &&
    sizeCheck.options.disabled !== true &&
    sizeCheck.options.compatibility !== false &&
    sizeCheck.options.compatibility?.rules?.["compat.gmail-clipping"] !== "off",
);
const checkingSize = ref(false);
const sizeBytes = ref<number | null>(null);
const sizeIssue = ref<LintIssue | null>(null);
const sizeError = ref("");
const sizeStale = ref(false);
let contentRevision = 0;
let destroyed = false;

if (editor) {
  watch(
    editor.content,
    () => {
      contentRevision++;
      if (sizeBytes.value !== null) sizeStale.value = true;
    },
    { deep: true },
  );
}
onUnmounted(() => {
  destroyed = true;
});

async function checkSize(): Promise<void> {
  if (!sizeCheck || !sizeAvailable.value || checkingSize.value) return;
  const revision = contentRevision;
  checkingSize.value = true;
  sizeError.value = "";
  try {
    const html = await sizeCheck.renderHtml();
    const quality = await import("@templatical/quality");
    if (destroyed) return;
    sizeBytes.value = new TextEncoder().encode(html).byteLength;
    sizeIssue.value =
      quality.lintCompiledHtml(html, {
        ...sizeCheck.options,
        locale: sizeCheck.options.locale ?? locale,
      })[0] ?? null;
    sizeStale.value = revision !== contentRevision;
  } catch (error) {
    if (!destroyed)
      sizeError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (!destroyed) checkingSize.value = false;
  }
}

const visibleIssues = computed(() => [
  ...(lint?.issues.value ?? []),
  ...(sizeIssue.value && !sizeStale.value ? [sizeIssue.value] : []),
]);

const errors = computed(() =>
  visibleIssues.value.filter((i) => i.severity === "error"),
);
const warnings = computed(() =>
  visibleIssues.value.filter((i) => i.severity === "warning"),
);
const infos = computed(() =>
  visibleIssues.value.filter((i) => i.severity === "info"),
);

const totalCount = computed(
  () => errors.value.length + warnings.value.length + infos.value.length,
);

function jumpTo(issue: LintIssue): void {
  if (!editor) return;
  if (!issue.blockId) return;
  editor.selectBlock(issue.blockId);
  // Selecting is invisible on its own — on a long template the block sits
  // below the fold and the canvas stays put, so "Jump" appears to do nothing.
  scrollToBlock(issue.blockId);
}

function applyFix(issue: LintIssue): void {
  lint?.applyFix(issue);
}
</script>

<template>
  <div class="tpl:flex tpl:flex-col tpl:gap-4 tpl:p-4">
    <header class="tpl:flex tpl:items-center tpl:gap-2">
      <ListChecks :size="16" :stroke-width="1.5" />
      <h3
        class="tpl:m-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
      >
        {{ t.issues.panelTitle }}
      </h3>
      <span
        v-if="totalCount > 0"
        class="tpl:ml-auto tpl:rounded-full tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-0.5 tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
        :title="format(t.issues.issueCountTooltip, { count: totalCount })"
      >
        {{ totalCount }}
      </span>
    </header>

    <div
      v-if="sizeAvailable"
      class="tpl:flex tpl:flex-col tpl:gap-1.5 tpl:text-xs"
    >
      <button
        type="button"
        data-testid="issue-check-size"
        :disabled="checkingSize"
        class="tpl:self-start tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2.5 tpl:py-1.5 tpl:font-medium tpl:text-[var(--tpl-text)] tpl:hover:bg-[var(--tpl-bg-active)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)] tpl:disabled:opacity-60"
        @click="checkSize"
      >
        {{ checkingSize ? t.issues.checkingSize : t.issues.checkSize }}
      </button>
      <p
        v-if="sizeBytes !== null"
        class="tpl:m-0 tpl:text-[var(--tpl-text-muted)]"
      >
        {{
          format(t.issues.sizeResult, {
            size: new Intl.NumberFormat(locale, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }).format(sizeBytes / 1024),
          })
        }}
      </p>
      <p
        v-if="sizeStale"
        role="status"
        class="tpl:m-0 tpl:text-[var(--tpl-text-muted)]"
      >
        {{ t.issues.sizeOutdated }}
      </p>
      <p
        v-if="sizeError"
        role="alert"
        class="tpl:m-0 tpl:text-[var(--tpl-danger)]"
      >
        {{ format(t.issues.sizeError, { error: sizeError }) }}
      </p>
    </div>

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
      {{ t.issues.emptyState }}
    </div>

    <template v-else>
      <section
        v-for="group in [
          {
            key: 'errors',
            title: t.issues.groupErrors,
            icon: AlertCircle,
            items: errors,
            tone: 'tpl:text-[var(--tpl-danger)]',
          },
          {
            key: 'warnings',
            title: t.issues.groupWarnings,
            icon: AlertTriangle,
            items: warnings,
            tone: 'tpl:text-[var(--tpl-warning)]',
          },
          {
            key: 'info',
            title: t.issues.groupInfo,
            icon: Info,
            items: infos,
            tone: 'tpl:text-[var(--tpl-text-muted)]',
          },
        ]"
        :key="group.key"
      >
        <header
          v-if="group.items.length > 0"
          class="tpl:mb-2 tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:font-semibold tpl:uppercase tpl:tracking-wide"
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
              class="tpl:m-0 tpl:mb-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
            >
              {{ issue.suggestion }}
            </p>
            <p
              class="tpl:m-0 tpl:mb-2 tpl:font-mono tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
            >
              {{ issue.ruleId }}
            </p>
            <a
              :href="issue.reference"
              target="_blank"
              rel="noopener"
              class="tpl:mb-2 tpl:inline-block tpl:text-xs tpl:text-[var(--tpl-primary)] tpl:underline tpl:underline-offset-2 tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)]"
              >{{ t.issues.learnMore }}</a
            >
            <div class="tpl:flex tpl:gap-1.5">
              <button
                v-if="issue.blockId"
                type="button"
                data-testid="issue-jump"
                class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]"
                @click="jumpTo(issue)"
              >
                <ArrowRight :size="10" :stroke-width="2" />
                {{ t.issues.jump }}
              </button>
              <button
                v-if="issue.fix"
                type="button"
                class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded-md tpl:bg-[var(--tpl-primary)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-on-primary)]"
                :title="issue.fix.description"
                @click="applyFix(issue)"
              >
                <Wrench :size="10" :stroke-width="2" />
                {{ t.issues.fix }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
