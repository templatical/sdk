<script setup lang="ts">
import {
  ChevronDown,
  CircleAlert,
  Eye,
  Info,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TriangleAlert,
  Undo2,
  Zap,
} from "@lucide/vue";
import {
  computed,
  inject,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import type {
  ScoringCategory,
  ScoringFinding,
  ScoringResult,
} from "@templatical/types";
import LoadingTrack from "../LoadingTrack.vue";
import AiPanelShell from "./AiPanelShell.vue";
import {
  scoreBgColor,
  scoreColor,
  severityBgColor,
  severityColor,
} from "./scoringStyles";
import type { UseAiFeatureReturn } from "../../composables/useAiFeature";
import { useI18n } from "../../composables/useI18n";
import { secondaryBtnCompactClass } from "../../constants/styleConstants";
import { CAPABILITIES_KEY, TEMPLATE_LINT_KEY, UI_LOCALE_KEY } from "../../keys";
import { aiErrorMessage, type AiErrorContext } from "../../utils/aiErrors";

const props = defineProps<{
  feature: Pick<
    UseAiFeatureReturn,
    | "has"
    | "templateId"
    | "isRunning"
    | "score"
    | "fix"
    | "undoMessage"
    | "messages"
  >;
}>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t, format } = useI18n();
const caps = inject(CAPABILITIES_KEY, {});
const lint = inject(TEMPLATE_LINT_KEY, null);
const uiLocale = inject(UI_LOCALE_KEY, undefined);

/** The AI scores these three; the linter owns accessibility (D23). */
const CATEGORIES: ScoringCategory[] = ["spam", "readability", "bestPractices"];
const ICONS: Record<ScoringCategory, typeof ShieldCheck> = {
  spam: ShieldX,
  readability: Eye,
  bestPractices: Zap,
};

const result = ref<ScoringResult | null>(null);
const isScoring = ref(false);
const failure = ref<{ error: unknown; context: AiErrorContext } | null>(null);
const fixing = ref<string | null>(null);
/** category plus finding id → the fix's message id, while it stands. */
const fixed = ref<Record<string, string>>({});
const replies = ref<Record<string, string>>({});
const expanded = ref<Record<ScoringCategory, boolean>>({
  spam: true,
  readability: true,
  bestPractices: true,
});
let controller: AbortController | null = null;
let active = false;
let generation = 0;

const canFix = computed(() => props.feature.has("fixFinding"));
const issueCount = computed(() => lint?.issues.value.length ?? 0);
/** The Issues tab exists while the linter runs; `Editor.vue` opens it. */
const canOpenIssues = computed(
  () => caps.issues !== undefined && lint !== null && !lint.unavailable.value,
);
const failureText = computed(() =>
  failure.value
    ? aiErrorMessage(
        failure.value.error,
        t.ai.errors,
        format,
        uiLocale,
        failure.value.context,
      )
    : "",
);
const totalFindings = computed(() =>
  result.value
    ? CATEGORIES.reduce(
        (total, category) =>
          total + result.value!.categories[category].findings.length,
        0,
      )
    : 0,
);

/** Pending actions belong to the template and scoring result they started on. */
function invalidateActions(): void {
  generation++;
  controller?.abort();
  controller = null;
  isScoring.value = false;
  fixing.value = null;
}

async function score(): Promise<void> {
  invalidateActions();
  const token = generation;
  const request = new AbortController();
  controller = request;
  isScoring.value = true;
  failure.value = null;
  fixed.value = {};
  replies.value = {};
  try {
    const scored = await props.feature.score(request.signal);
    if (token === generation) result.value = scored;
  } catch (error) {
    if (
      token === generation &&
      !(error instanceof Error && error.name === "AbortError")
    ) {
      failure.value = { error, context: "turn" };
    }
  } finally {
    if (token === generation) {
      isScoring.value = false;
      controller = null;
    }
  }
}

async function fix(
  finding: ScoringFinding,
  category: ScoringCategory,
): Promise<void> {
  if (fixing.value !== null || props.feature.isRunning.value) return;
  const token = generation;
  const key = findingKey(category, finding.id);
  fixing.value = key;
  failure.value = null;
  try {
    const outcome = await props.feature.fix({
      id: finding.id,
      message: finding.message,
      suggestion: finding.suggestion,
      category,
      blockId: finding.blockId,
    });
    if (token !== generation) return;
    if (outcome.operationCount > 0 && outcome.messageId !== null) {
      fixed.value = { ...fixed.value, [key]: outcome.messageId };
    } else if (outcome.text !== "") {
      replies.value = { ...replies.value, [key]: outcome.text };
    }
  } finally {
    if (token === generation) fixing.value = null;
  }
}

function findingKey(category: ScoringCategory, id: string): string {
  return `${category}:${id}`;
}

function fixedMessage(findingId: string) {
  const messageId = fixed.value[findingId];
  return props.feature.messages.value.find(
    (item) => item.id === messageId && item.role === "assistant",
  );
}

async function undoFix(findingId: string): Promise<void> {
  const token = generation;
  const message = fixedMessage(findingId);
  if (!message?.canUndo) return;
  await props.feature.undoMessage(message.id);
  if (token !== generation) return;
  if (message.undone) {
    const rest = { ...fixed.value };
    delete rest[findingId];
    fixed.value = rest;
  }
}

// Chat can undo a fix while this panel is cached. Follow that message's state.
watch(
  () =>
    Object.keys(fixed.value).filter(
      (findingId) => fixedMessage(findingId)?.undone,
    ),
  (undone) => {
    if (undone.length === 0) return;
    const rest = { ...fixed.value };
    for (const findingId of undone) delete rest[findingId];
    fixed.value = rest;
  },
  { flush: "sync" },
);

function scoreIfNeeded(): void {
  if (
    active &&
    props.feature.templateId.value !== null &&
    !result.value &&
    !failure.value &&
    !isScoring.value
  ) {
    void score();
  }
}

function activate(): void {
  active = true;
  scoreIfNeeded();
}

onMounted(activate);
onActivated(activate);
onDeactivated(() => {
  active = false;
  if (isScoring.value) invalidateActions();
});
onUnmounted(() => {
  active = false;
  invalidateActions();
});

// Another template has its own score.
watch(
  () => props.feature.templateId.value,
  () => {
    invalidateActions();
    result.value = null;
    failure.value = null;
    fixed.value = {};
    replies.value = {};
    // Core finishes loading content and the feature swaps sessions in this tick.
    const token = generation;
    void nextTick(() => {
      if (token === generation) scoreIfNeeded();
    });
  },
  { flush: "sync" },
);
</script>

<template>
  <AiPanelShell
    :title="t.ai.scoring.title"
    :subtitle="t.ai.chat.notice"
    testid="ai-panel-scoring"
    :close-label="t.ai.scoring.close"
    @close="emit('close')"
  >
    <template #actions>
      <button
        v-if="result && !isScoring"
        type="button"
        data-testid="scoring-rescore"
        class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:text-[var(--tpl-text-muted)]"
        :aria-label="t.ai.scoring.rescore"
        :title="t.ai.scoring.rescore"
        @click="score()"
      >
        <RefreshCw :size="14" :stroke-width="2" aria-hidden="true" />
      </button>
    </template>

    <div class="tpl:flex-1 tpl:overflow-y-auto tpl:p-4">
      <div
        v-if="isScoring"
        class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
      >
        <p class="tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
          {{ t.ai.scoring.scoring }}
        </p>
        <LoadingTrack class="tpl:w-3/4" />
      </div>

      <div
        v-else-if="failure && !result"
        data-testid="scoring-error"
        class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
      >
        <CircleAlert
          :size="32"
          :stroke-width="1.5"
          class="tpl:text-[var(--tpl-danger)]"
          aria-hidden="true"
        />
        <p
          class="tpl:max-w-[240px] tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
        >
          {{ failureText }}
        </p>
        <button
          type="button"
          :class="secondaryBtnCompactClass"
          @click="score()"
        >
          <RefreshCw :size="12" :stroke-width="2" aria-hidden="true" />
          {{ t.ai.scoring.rescore }}
        </button>
      </div>

      <div v-else-if="result" class="tpl:flex tpl:flex-col tpl:gap-4">
        <div
          data-testid="scoring-overall"
          class="tpl:flex tpl:flex-col tpl:items-center tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:p-5"
          :style="{ backgroundColor: scoreBgColor(result.score) }"
        >
          <span
            class="tpl:text-4xl tpl:font-bold tpl:tabular-nums"
            :style="{ color: scoreColor(result.score) }"
          >
            {{ result.score }}
          </span>
          <span
            class="tpl:text-xs tpl:font-medium tpl:uppercase tpl:tracking-wider tpl:text-[var(--tpl-text-muted)]"
          >
            {{ t.ai.scoring.overallScore }}
          </span>
          <span
            v-if="totalFindings > 0"
            class="tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
          >
            {{
              totalFindings === 1
                ? t.ai.scoring.finding
                : format(t.ai.scoring.findings, { count: totalFindings })
            }}
          </span>
        </div>

        <!-- Accessibility belongs to the linter (D23). -->
        <div
          data-testid="scoring-accessibility-note"
          class="tpl:flex tpl:items-center tpl:gap-2 tpl:rounded-[var(--tpl-radius-sm)] tpl:px-3 tpl:py-2 tpl:text-xs tpl:bg-[var(--tpl-secondary-light)] tpl:text-[var(--tpl-text)]"
        >
          <ListChecks
            :size="14"
            :stroke-width="2"
            class="tpl:shrink-0"
            aria-hidden="true"
          />
          <span class="tpl:flex-1">{{ t.ai.scoring.accessibilityNote }}</span>
          <button
            v-if="canOpenIssues"
            type="button"
            data-testid="scoring-open-issues"
            :class="secondaryBtnCompactClass"
            @click="caps.issues?.open()"
          >
            {{ format(t.ai.scoring.openIssues, { count: issueCount }) }}
          </button>
        </div>

        <div
          v-if="failure && result"
          role="alert"
          data-testid="scoring-fix-error"
          class="tpl:flex tpl:items-start tpl:gap-2 tpl:rounded-lg tpl:px-3 tpl:py-2 tpl:text-xs tpl:bg-[var(--tpl-danger-light)] tpl:text-[var(--tpl-danger)]"
        >
          <CircleAlert
            :size="14"
            :stroke-width="2"
            class="tpl:mt-0.5 tpl:shrink-0"
            aria-hidden="true"
          />
          <span>{{ failureText }}</span>
        </div>

        <div
          v-for="category in CATEGORIES"
          :key="category"
          class="tpl:overflow-hidden tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)]"
        >
          <button
            type="button"
            data-testid="scoring-category"
            class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-2.5 tpl:px-3 tpl:py-2.5 tpl:text-left tpl:transition-colors tpl:bg-[var(--tpl-bg)]"
            :aria-expanded="expanded[category]"
            @click="expanded[category] = !expanded[category]"
          >
            <component
              :is="ICONS[category]"
              :size="14"
              :stroke-width="2"
              aria-hidden="true"
              :style="{ color: scoreColor(result.categories[category].score) }"
            />
            <span
              class="tpl:flex-1 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]"
            >
              {{ t.ai.scoring.categories[category] }}
            </span>
            <span
              class="tpl:rounded-full tpl:px-2 tpl:py-0.5 tpl:text-xs tpl:font-semibold tpl:tabular-nums"
              :style="{
                color: scoreColor(result.categories[category].score),
                backgroundColor: scoreBgColor(
                  result.categories[category].score,
                ),
              }"
            >
              {{ result.categories[category].score }}
            </span>
            <ChevronDown
              :size="12"
              :stroke-width="2"
              aria-hidden="true"
              class="tpl:transition-transform tpl:duration-200 tpl:text-[var(--tpl-text-dim)]"
              :class="expanded[category] ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
            />
          </button>

          <div
            v-if="expanded[category]"
            class="tpl:border-t tpl:border-[var(--tpl-border)]"
          >
            <div
              v-if="result.categories[category].findings.length === 0"
              class="tpl:px-3 tpl:py-3 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
            >
              {{ t.ai.scoring.noFindings }}
            </div>
            <div
              v-for="finding in result.categories[category].findings"
              :key="finding.id"
              data-testid="scoring-finding"
              class="tpl:border-t tpl:px-3 tpl:py-2.5 tpl:first:border-t-0 tpl:border-[var(--tpl-border-light)]"
            >
              <div class="tpl:flex tpl:items-start tpl:gap-2">
                <component
                  :is="
                    finding.severity === 'high'
                      ? CircleAlert
                      : finding.severity === 'medium'
                        ? TriangleAlert
                        : Info
                  "
                  :size="13"
                  :stroke-width="2"
                  aria-hidden="true"
                  class="tpl:mt-0.5 tpl:shrink-0"
                  :style="{ color: severityColor(finding.severity) }"
                />
                <div class="tpl:min-w-0 tpl:flex-1">
                  <div class="tpl:flex tpl:items-start tpl:gap-1.5">
                    <span
                      class="tpl:mt-0.5 tpl:shrink-0 tpl:rounded tpl:px-1 tpl:py-px tpl:text-[10px] tpl:font-medium tpl:leading-tight"
                      :style="{
                        color: severityColor(finding.severity),
                        backgroundColor: severityBgColor(finding.severity),
                      }"
                    >
                      {{ t.ai.scoring.severity[finding.severity] }}
                    </span>
                    <span
                      class="tpl:text-xs tpl:leading-snug tpl:text-[var(--tpl-text)]"
                      >{{ finding.message }}</span
                    >
                  </div>
                  <p
                    v-if="finding.suggestion"
                    class="tpl:mt-1 tpl:text-[10px] tpl:leading-snug tpl:text-[var(--tpl-text-dim)]"
                  >
                    {{ finding.suggestion }}
                  </p>

                  <!-- Fixed: the fix's message Undo reverts it (D23). -->
                  <div
                    v-if="fixed[findingKey(category, finding.id)]"
                    data-testid="scoring-fixed"
                    class="tpl:mt-2 tpl:flex tpl:items-center tpl:justify-center tpl:gap-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
                  >
                    <span>{{ t.ai.scoring.fixed }}</span>
                    <button
                      v-if="
                        fixedMessage(findingKey(category, finding.id))?.canUndo
                      "
                      type="button"
                      data-testid="scoring-undo-fix"
                      :class="secondaryBtnCompactClass"
                      :disabled="feature.isRunning.value"
                      @click="undoFix(findingKey(category, finding.id))"
                    >
                      <Undo2 :size="11" :stroke-width="2" aria-hidden="true" />
                      {{ t.ai.scoring.undoFix }}
                    </button>
                  </div>
                  <div
                    v-else-if="canFix"
                    class="tpl:mt-2 tpl:flex tpl:flex-col tpl:items-center tpl:gap-1.5"
                  >
                    <button
                      type="button"
                      data-testid="scoring-fix"
                      class="tpl-scoring-fix-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:disabled:opacity-50 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-primary)]"
                      style="background-color: transparent"
                      :disabled="fixing !== null || feature.isRunning.value"
                      @click="fix(finding, category)"
                    >
                      <LoaderCircle
                        v-if="fixing === findingKey(category, finding.id)"
                        class="tpl-spinner"
                        :size="11"
                        :stroke-width="2"
                        aria-hidden="true"
                      />
                      <Sparkles
                        v-else
                        :size="11"
                        :stroke-width="2"
                        aria-hidden="true"
                      />
                      {{
                        fixing === findingKey(category, finding.id)
                          ? t.ai.scoring.fixing
                          : t.ai.scoring.fix
                      }}
                    </button>
                    <p
                      v-if="replies[findingKey(category, finding.id)]"
                      data-testid="scoring-fix-reply"
                      class="tpl:m-0 tpl:text-[10px] tpl:leading-snug tpl:text-[var(--tpl-text-muted)] tpl:whitespace-pre-wrap"
                    >
                      {{ replies[findingKey(category, finding.id)] }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
      >
        <ShieldCheck
          :size="32"
          :stroke-width="1.5"
          class="tpl:text-[var(--tpl-text-dim)]"
          aria-hidden="true"
        />
        <p
          class="tpl:max-w-[240px] tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.ai.scoring.emptyState }}
        </p>
      </div>
    </div>
  </AiPanelShell>
</template>

<style scoped>
.tpl-scoring-fix-btn:not(:disabled):hover {
  border-color: var(--tpl-primary) !important;
  background-color: var(--tpl-primary-light) !important;
}
</style>
