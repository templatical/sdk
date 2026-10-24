<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  inject,
  nextTick,
  onUnmounted,
  ref,
  watch,
} from "vue";
import {
  ListChecks,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  Wrench,
  Check,
  Sparkles,
  Square,
} from "@lucide/vue";
import { useI18n } from "../../composables/useI18n";
import { useScrollToBlock } from "../../composables/useScrollToBlock";
import {
  TEMPLATE_LINT_KEY,
  AI_FEATURE_KEY,
  EDITOR_KEY,
  SIZE_CHECK_KEY,
  UI_LOCALE_KEY,
} from "../../keys";
import type { LintIssue } from "../../composables/useTemplateLint";

import {
  AI_ALT_TEXT_RULES,
  AI_FIXABLE_RULES,
  toAiFixFinding,
} from "../../utils/aiFixableRules";

const AiAltTextPopover = defineAsyncComponent(
  () => import("../ai/AiAltTextPopover.vue"),
);
const AiAltTextReview = defineAsyncComponent(
  () => import("../ai/AiAltTextReview.vue"),
);
const bulkBlockIds = ref<string[] | null>(null);
const bulkButton = ref<HTMLButtonElement | null>(null);
function openBulkAltText(): void {
  if (!ai || ai.busy.value) return;
  void closeAltText();
  bulkBlockIds.value = [...altTextTargets.value];
}
async function closeBulkAltText(): Promise<void> {
  bulkBlockIds.value = null;
  await nextTick();
  if (!destroyed && altReview.value === null) {
    (bulkButton.value ?? panelHeading.value)?.focus();
  }
}
interface AltReviewRow {
  blockId: string;
  ruleId: string;
  severity: LintIssue["severity"];
}
const altReview = ref<AltReviewRow | null>(null);
const altBlockId = computed(() => altReview.value?.blockId ?? null);
const altController = ref<AbortController | null>(null);
const panelHeading = ref<HTMLHeadingElement | null>(null);
let altButton: HTMLButtonElement | null = null;
function ownsAltReview(issue: LintIssue): boolean {
  const row = altReview.value;
  return (
    row !== null &&
    row.blockId === issue.blockId &&
    row.ruleId === issue.ruleId &&
    row.severity === issue.severity
  );
}
function openAltText(issue: LintIssue, event: MouseEvent): void {
  if (!issue.blockId || ownsAltReview(issue)) return;
  bulkBlockIds.value = null;
  altController.value?.abort();
  altController.value = null;
  altButton = event.currentTarget as HTMLButtonElement;
  altReview.value = {
    blockId: issue.blockId,
    ruleId: issue.ruleId,
    severity: issue.severity,
  };
}
async function closeAltText(
  focus: "button" | "panel" = "button",
): Promise<void> {
  if (altReview.value === null) return;
  altReview.value = null;
  altController.value?.abort();
  altController.value = null;
  const button = altButton;
  altButton = null;
  await nextTick();
  if (destroyed || altReview.value !== null || bulkBlockIds.value !== null)
    return;
  (focus === "button" && button?.isConnected
    ? button
    : panelHeading.value
  )?.focus();
}
function setAltDrafting(
  issue: LintIssue,
  controller: AbortController | null,
): void {
  if (ownsAltReview(issue)) altController.value = controller;
}
const { t, format } = useI18n();
const ai = inject(AI_FEATURE_KEY, null);
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

// Verify against a lint result covering the final content of a successful fix.
const pendingVerify = new Set<string>();
const stillFlagged = ref(new Set<string>());
const runningPair = ref<string | null>(null);
const pairOf = (issue: LintIssue): string =>
  JSON.stringify([issue.ruleId, issue.blockId]);

function verify(issues: LintIssue[]): void {
  const current = new Set(issues.map(pairOf));
  for (const pair of stillFlagged.value) {
    if (!current.has(pair)) stillFlagged.value.delete(pair);
  }
  for (const pair of pendingVerify) {
    if (current.has(pair)) stillFlagged.value.add(pair);
  }
  pendingVerify.clear();
}
if (lint) {
  watch(lint.issues, verify, { flush: "sync" });
}

if (ai) {
  // Close even while the lazy component is still loading and owns no watchers.
  watch(
    [ai.templateId, ai.isAvailable, () => editor?.loadVersion?.value],
    () => {
      if (bulkBlockIds.value !== null) void closeBulkAltText();
    },
    { flush: "sync" },
  );
  watch(
    ai.templateSession,
    () => {
      void closeAltText();
    },
    { flush: "sync" },
  );
  watch(
    ai.sessionIdentity,
    () => {
      pendingVerify.clear();
      stillFlagged.value.clear();
    },
    { flush: "sync" },
  );
}

// Rows retain their existing keys. Repeated hits have no stable occurrence
// locator, so only the first row of each rule/block pair offers an AI fix.
const firstRows = computed(() => {
  const pairs = new Set<string>();
  return new Set(
    [...errors.value, ...warnings.value, ...infos.value].filter((issue) => {
      const pair = pairOf(issue);
      if (pairs.has(pair)) return false;
      pairs.add(pair);
      return true;
    }),
  );
});
const firstAltRows = computed(() => {
  const seen = new Set<string>();
  return new Set(
    [...errors.value, ...warnings.value, ...infos.value].filter((issue) => {
      if (
        !issue.blockId ||
        !(AI_ALT_TEXT_RULES as readonly string[]).includes(issue.ruleId) ||
        seen.has(issue.blockId)
      )
        return false;
      seen.add(issue.blockId);
      return true;
    }),
  );
});
// The location helper supplies document order across root blocks and columns.
const altTextTargets = computed(() => {
  if (!editor) return [];
  const ids = new Set(
    visibleIssues.value
      .filter((issue) =>
        (AI_ALT_TEXT_RULES as readonly string[]).includes(issue.ruleId),
      )
      .map((issue) => issue.blockId)
      .filter((id): id is string => id !== null),
  );
  const blocks = editor.content.value.blocks;
  return [...ids]
    .flatMap((id) => {
      const location = editor.findBlockLocation(id);
      if (!location) return [];
      return [
        {
          id,
          root: location.targetSectionId
            ? blocks.findIndex((block) => block.id === location.targetSectionId)
            : location.index,
          column: location.columnIndex ?? -1,
          index: location.index,
        },
      ];
    })
    .sort((a, b) => a.root - b.root || a.column - b.column || a.index - b.index)
    .map(({ id }) => id);
});
// A lint refresh can remove or regroup the owning row before the whole image's
// findings disappear. Clear the review now so a later row cannot restart it.
watch(
  () =>
    altReview.value === null ||
    (visibleIssues.value.some(ownsAltReview) &&
      (!editor || editor.findBlockLocation(altReview.value.blockId) !== null)),
  (visible) => {
    if (!visible) void closeAltText("panel");
  },
  { flush: "sync" },
);
function canWriteAltText(issue: LintIssue): boolean {
  return (
    !!ai &&
    ai.isAvailable.value &&
    ai.has("altText") &&
    firstAltRows.value.has(issue)
  );
}
function canFixWithAi(issue: LintIssue): boolean {
  return (
    !!ai &&
    ai.isAvailable.value &&
    ai.has("fixFinding") &&
    !issue.fix &&
    (AI_FIXABLE_RULES as readonly string[]).includes(issue.ruleId) &&
    firstRows.value.has(issue)
  );
}
async function fixWithAi(issue: LintIssue): Promise<void> {
  if (
    !canFixWithAi(issue) ||
    !ai ||
    ai.busy.value ||
    runningPair.value !== null
  )
    return;
  const pair = pairOf(issue);
  const sessionIdentity = ai.sessionIdentity.value;
  runningPair.value = pair;
  stillFlagged.value.delete(pair);
  try {
    const outcome = await ai.fix(toAiFixFinding(issue));
    if (
      !destroyed &&
      ai.sessionIdentity.value === sessionIdentity &&
      !outcome.failed
    ) {
      pendingVerify.add(pair);
      if (
        lint?.contentVersion &&
        lint.lintVersion.value === lint.contentVersion.value
      )
        verify(lint.issues.value);
    }
  } finally {
    runningPair.value = null;
  }
}

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
        ref="panelHeading"
        tabindex="-1"
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

    <section
      v-if="sizeAvailable"
      class="tpl:flex tpl:flex-col tpl:gap-2 tpl:text-xs"
    >
      <h4 class="tpl:m-0 tpl:font-semibold tpl:text-[var(--tpl-text)]">
        {{ t.issues.emailSize }}
      </h4>
      <p class="tpl:m-0 tpl:text-[var(--tpl-text-muted)]">
        {{ t.issues.sizeExplainer }}
      </p>
      <button
        type="button"
        data-testid="issue-check-size"
        :disabled="checkingSize"
        class="tpl:w-full tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2.5 tpl:py-1.5 tpl:font-medium tpl:text-[var(--tpl-text)] tpl:hover:bg-[var(--tpl-bg-active)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)] tpl:disabled:opacity-60"
        @click="checkSize"
      >
        {{
          checkingSize
            ? t.issues.checkingSize
            : sizeStale
              ? t.issues.checkSizeAgain
              : t.issues.checkSize
        }}
      </button>
      <p
        v-if="sizeBytes !== null"
        data-testid="issue-size-result"
        class="tpl:m-0 tpl:flex tpl:items-center tpl:gap-1 tpl:text-[var(--tpl-text-muted)]"
      >
        <Check
          v-if="!sizeIssue && !sizeStale"
          :size="14"
          :stroke-width="2"
          aria-hidden="true"
        />
        {{
          format(
            !sizeIssue && !sizeStale ? t.issues.sizePass : t.issues.sizeResult,
            {
              size: new Intl.NumberFormat(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }).format(sizeBytes / 1024),
            },
          )
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
    </section>

    <div
      v-if="runningPair !== null || altController !== null"
      role="status"
      data-testid="issue-ai-status"
      class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
    >
      <span>{{ altController ? t.ai.altText.drafting : t.ai.fix.fixing }}</span>
      <button
        type="button"
        data-testid="issue-ai-stop"
        class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)]"
        @click="altController ? altController.abort() : ai?.stop()"
      >
        <Square :size="10" :stroke-width="2" />
        {{ t.ai.chat.stop }}
      </button>
    </div>

    <button
      v-if="
        ai?.isAvailable.value && ai.has('altText') && altTextTargets.length >= 2
      "
      ref="bulkButton"
      type="button"
      data-testid="issue-ai-alt-text-bulk"
      :disabled="ai.busy.value"
      class="tpl:flex tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2.5 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)] tpl:disabled:opacity-60"
      @click="openBulkAltText"
    >
      <Sparkles :size="12" :stroke-width="2" aria-hidden="true" />
      {{ format(t.ai.altText.bulk, { count: altTextTargets.length }) }}
    </button>
    <AiAltTextReview
      v-if="bulkBlockIds !== null && ai"
      :block-ids="bulkBlockIds"
      :feature="ai"
      @close="closeBulkAltText"
    />

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
            <div class="tpl:flex tpl:flex-wrap tpl:items-center tpl:gap-1.5">
              <a
                :href="issue.reference"
                target="_blank"
                rel="noopener"
                class="tpl:inline-block tpl:text-xs tpl:text-[var(--tpl-primary)] tpl:underline tpl:underline-offset-2 tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)]"
                >{{ t.issues.learnMore }}</a
              >
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
              <button
                v-if="canWriteAltText(issue)"
                type="button"
                data-testid="issue-ai-alt-text"
                :disabled="ai!.busy.value"
                class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)] tpl:disabled:opacity-60"
                @click="openAltText(issue, $event)"
              >
                <Sparkles :size="10" :stroke-width="2" />
                {{ t.ai.altText.button }}
              </button>
              <button
                v-if="canFixWithAi(issue)"
                type="button"
                data-testid="issue-ai-fix"
                :disabled="ai!.busy.value"
                class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)] tpl:focus-visible:outline-2 tpl:focus-visible:outline-[var(--tpl-primary)] tpl:disabled:opacity-60"
                @click="fixWithAi(issue)"
              >
                <Sparkles :size="10" :stroke-width="2" />
                {{ t.ai.fix.button }}
              </button>
            </div>
            <AiAltTextPopover
              v-if="ownsAltReview(issue) && firstRows.has(issue)"
              :key="JSON.stringify(altReview)"
              :block-id="altBlockId!"
              @close="closeAltText"
              @drafting="setAltDrafting(issue, $event)"
            />
            <p
              v-if="stillFlagged.has(pairOf(issue)) && firstRows.has(issue)"
              role="status"
              class="tpl:m-0 tpl:mt-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
            >
              {{ t.ai.fix.stillFlagged }}
            </p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
