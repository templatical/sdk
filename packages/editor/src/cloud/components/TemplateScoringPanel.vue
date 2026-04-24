<script setup lang="ts">
import LoadingTrack from "../../components/LoadingTrack.vue";
import {
  EDITOR_KEY,
  SCORING_KEY,
  MERGE_TAGS_KEY,
  requireInject,
} from "../../keys";
import {
  scoreColor,
  scoreBgColor,
  severityColor,
  severityBgColor,
} from "../utils/scoringStyles";
import { useI18n } from "../../composables/useI18n";
import type { ScoringCategory, ScoringFinding } from "@templatical/types";
import {
  CircleAlert,
  TriangleAlert,
  ChevronDown,
  Eye,
  Info,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Sparkles,
  X,
  Zap,
} from "@lucide/vue";
import { inject, ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { t } = useI18n();
const editor = requireInject(EDITOR_KEY, "TemplateScoringPanel");
const scoring = requireInject(SCORING_KEY, "TemplateScoringPanel");
const mergeTags = inject(MERGE_TAGS_KEY, []);

const expandedCategories = ref<Record<string, boolean>>({
  spam: true,
  readability: true,
  accessibility: true,
  bestPractices: true,
});

function toggleCategory(category: string): void {
  expandedCategories.value[category] = !expandedCategories.value[category];
}

const categoryOrder: ScoringCategory[] = [
  "spam",
  "readability",
  "accessibility",
  "bestPractices",
];

const categoryIcons: Record<ScoringCategory, typeof ShieldCheck> = {
  spam: ShieldX,
  readability: Eye,
  accessibility: Sparkles,
  bestPractices: Zap,
};

function triggerScore(): void {
  scoring.score(editor.content.value, mergeTags);
}

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible && !scoring.scoringResult.value && !scoring.isScoring.value) {
      triggerScore();
    }
  },
);

async function handleFix(finding: ScoringFinding): Promise<void> {
  if (!finding.blockId) {
    return;
  }

  // Get the block content from the editor
  const block = editor.content.value.blocks.find(
    (b) => b.id === finding.blockId,
  );
  if (!block) {
    return;
  }

  // Extract HTML content from the block (text blocks have content property)
  const blockContent = (block as unknown as Record<string, unknown>).content as
    | string
    | undefined;
  if (!blockContent) {
    return;
  }

  const fixedContent = await scoring.fixFinding(
    blockContent,
    finding,
    mergeTags,
  );

  if (fixedContent) {
    editor.updateBlock(finding.blockId, { content: fixedContent });
    scoring.removeFinding(finding.category, finding.id);
  }
}

function totalFindings(): number {
  if (!scoring.scoringResult.value) {
    return 0;
  }
  return categoryOrder.reduce((sum, cat) => {
    return (
      sum + (scoring.scoringResult.value?.categories[cat]?.findings.length ?? 0)
    );
  }, 0);
}
</script>

<template>
  <Transition
    enter-active-class="tpl-scoring-slide-enter-active"
    enter-from-class="tpl:translate-x-full"
    enter-to-class="tpl:translate-x-0"
    leave-active-class="tpl-scoring-slide-leave-active"
    leave-from-class="tpl:translate-x-0"
    leave-to-class="tpl:translate-x-full"
  >
    <div
      v-if="visible"
      class="tpl-scoring-panel tpl:absolute tpl:top-14 tpl:right-0 tpl:bottom-0 tpl:z-panel tpl:flex tpl:w-[360px] tpl:flex-col tpl:border-l tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)]"
    >
      <!-- Header -->
      <div
        class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-4 tpl:py-3"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-primary)]"
        >
          <ShieldCheck :size="13" :stroke-width="2" />
          <span>{{ t.scoring.title }}</span>
        </div>
        <div class="tpl:flex tpl:items-center tpl:gap-1">
          <button
            v-if="scoring.scoringResult.value && !scoring.isScoring.value"
            class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:duration-150 tpl:text-[var(--tpl-text-muted)]"
            :title="t.scoring.rescore"
            @click="triggerScore()"
          >
            <RefreshCw :size="14" :stroke-width="2" />
          </button>
          <button
            class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:duration-150 tpl:text-[var(--tpl-text-muted)]"
            @click="emit('close')"
          >
            <X :size="14" :stroke-width="2" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="tpl:flex-1 tpl:overflow-y-auto tpl:p-4">
        <!-- Loading state -->
        <div
          v-if="scoring.isScoring.value"
          class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
        >
          <p class="tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
            {{ t.scoring.scoring }}
          </p>
          <LoadingTrack class="tpl:w-3/4" />
        </div>

        <!-- Error state -->
        <div
          v-else-if="scoring.error.value && !scoring.scoringResult.value"
          class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
        >
          <CircleAlert
            :size="32"
            :stroke-width="1.5"
            class="tpl:text-[var(--tpl-danger)]"
          />
          <p
            class="tpl:max-w-[240px] tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
          >
            {{ t.scoring.error }}
          </p>
          <button
            class="tpl:mt-2 tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text-muted)]"
            @click="triggerScore()"
          >
            <RefreshCw :size="12" :stroke-width="2" />
            {{ t.scoring.rescore }}
          </button>
        </div>

        <!-- Results -->
        <div
          v-else-if="scoring.scoringResult.value"
          class="tpl:flex tpl:flex-col tpl:gap-4"
        >
          <!-- Overall score -->
          <div
            class="tpl:flex tpl:flex-col tpl:items-center tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:p-5"
            :style="{
              backgroundColor: scoreBgColor(scoring.scoringResult.value.score),
            }"
          >
            <span
              class="tpl:text-4xl tpl:font-bold tpl:tabular-nums"
              :style="{
                color: scoreColor(scoring.scoringResult.value.score),
              }"
            >
              {{ scoring.scoringResult.value.score }}
            </span>
            <span
              class="tpl:text-xs tpl:font-medium tpl:uppercase tpl:tracking-wider tpl:text-[var(--tpl-text-muted)]"
            >
              {{ t.scoring.overallScore }}
            </span>
            <span
              v-if="totalFindings() > 0"
              class="tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
            >
              {{ totalFindings() }}
              {{ t.scoring.findings }}
            </span>
          </div>

          <!-- Fix error -->
          <div
            v-if="scoring.fixError.value"
            class="tpl:flex tpl:items-start tpl:gap-2 tpl:rounded-lg tpl:px-3 tpl:py-2 tpl:text-xs tpl:bg-[var(--tpl-danger-light)] tpl:text-[var(--tpl-danger)]"
          >
            <CircleAlert
              :size="14"
              :stroke-width="2"
              class="tpl:mt-0.5 tpl:shrink-0"
            />
            <span>{{ t.scoring.fixError }}</span>
          </div>

          <!-- Category cards -->
          <div
            v-for="category in categoryOrder"
            :key="category"
            class="tpl:overflow-hidden tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)]"
          >
            <!-- Category header -->
            <button
              class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-2.5 tpl:px-3 tpl:py-2.5 tpl:text-left tpl:transition-colors tpl:duration-100 tpl:bg-[var(--tpl-bg)]"
              @click="toggleCategory(category)"
            >
              <component
                :is="categoryIcons[category]"
                :size="14"
                :stroke-width="2"
                :style="{
                  color: scoreColor(
                    scoring.scoringResult.value.categories[category].score,
                  ),
                }"
              />
              <span
                class="tpl:flex-1 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text)]"
              >
                {{ t.scoring.categories[category] }}
              </span>
              <span
                class="tpl:rounded-full tpl:px-2 tpl:py-0.5 tpl:text-xs tpl:font-semibold tpl:tabular-nums"
                :style="{
                  color: scoreColor(
                    scoring.scoringResult.value.categories[category].score,
                  ),
                  backgroundColor: scoreBgColor(
                    scoring.scoringResult.value.categories[category].score,
                  ),
                }"
              >
                {{ scoring.scoringResult.value.categories[category].score }}
              </span>
              <span
                v-if="
                  scoring.scoringResult.value.categories[category].findings
                    .length > 0
                "
                class="tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
              >
                {{
                  scoring.scoringResult.value.categories[category].findings
                    .length
                }}
              </span>
              <ChevronDown
                :size="12"
                :stroke-width="2"
                class="tpl:transition-transform tpl:duration-200 tpl:text-[var(--tpl-text-dim)]"
                :class="
                  expandedCategories[category]
                    ? 'tpl:rotate-0'
                    : 'tpl:-rotate-90'
                "
              />
            </button>

            <!-- Findings list -->
            <div
              v-if="expandedCategories[category]"
              class="tpl:border-t tpl:border-[var(--tpl-border)]"
            >
              <div
                v-if="
                  scoring.scoringResult.value.categories[category].findings
                    .length === 0
                "
                class="tpl:px-3 tpl:py-3 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
              >
                {{ t.scoring.noFindings }}
              </div>
              <div
                v-for="finding in scoring.scoringResult.value.categories[
                  category
                ].findings"
                :key="finding.id"
                class="tpl:border-t tpl:px-3 tpl:py-2.5 first:tpl:border-t-0 tpl:border-[var(--tpl-border-light)]"
              >
                <div class="tpl:flex tpl:items-start tpl:gap-2">
                  <!-- Severity icon -->
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
                    class="tpl:mt-0.5 tpl:shrink-0"
                    :style="{
                      color: severityColor(finding.severity),
                    }"
                  />
                  <div class="tpl:flex-1 tpl:min-w-0">
                    <!-- Severity badge + message -->
                    <div class="tpl:flex tpl:items-start tpl:gap-1.5">
                      <span
                        class="tpl:mt-0.5 tpl:shrink-0 tpl:rounded tpl:px-1 tpl:py-px tpl:text-[10px] tpl:font-medium tpl:leading-tight"
                        :style="{
                          color: severityColor(finding.severity),
                          backgroundColor: severityBgColor(finding.severity),
                        }"
                      >
                        {{ t.scoring.severity[finding.severity] }}
                      </span>
                      <span
                        class="tpl:text-xs tpl:leading-snug tpl:text-[var(--tpl-text)]"
                      >
                        {{ finding.message }}
                      </span>
                    </div>
                    <!-- Suggestion -->
                    <p
                      v-if="finding.suggestion"
                      class="tpl:mt-1 tpl:text-[11px] tpl:leading-snug tpl:text-[var(--tpl-text-dim)]"
                    >
                      {{ finding.suggestion }}
                    </p>
                    <!-- Fix button -->
                    <div
                      v-if="finding.blockId"
                      class="tpl:mt-2 tpl:flex tpl:justify-center"
                    >
                      <button
                        class="tpl-scoring-fix-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded tpl:border tpl:px-3 tpl:py-1.5 tpl:text-[11px] tpl:font-medium tpl:transition-all tpl:duration-150 tpl:disabled:opacity-50 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-primary)]"
                        style="background-color: transparent"
                        :disabled="scoring.fixingFindingId.value !== null"
                        @click="handleFix(finding)"
                      >
                        <LoaderCircle
                          v-if="scoring.fixingFindingId.value === finding.id"
                          class="tpl-spinner"
                          :size="11"
                          :stroke-width="2"
                        />
                        <Sparkles v-else :size="11" :stroke-width="2" />
                        {{
                          scoring.fixingFindingId.value === finding.id
                            ? t.scoring.fixing
                            : t.scoring.fix
                        }}
                      </button>
                      <p
                        v-if="scoring.fixError.value"
                        class="tpl:mt-1.5 tpl:text-[11px] tpl:text-[var(--tpl-danger)]"
                      >
                        {{ scoring.fixError.value }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state (no result, no loading, no error) -->
        <div
          v-else
          class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:text-center"
        >
          <ShieldCheck
            :size="32"
            :stroke-width="1.5"
            class="tpl:text-[var(--tpl-text-dim)]"
          />
          <p
            class="tpl:max-w-[240px] tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
          >
            {{ t.scoring.emptyState }}
          </p>
        </div>

        <!-- AI disclaimer -->
        <p
          class="tpl:m-0 tpl:px-4 tpl:pb-2 tpl:pt-2 tpl:text-center tpl:text-[11px] tpl:text-[var(--tpl-text-dim)]"
        >
          {{ t.aiMenu.disclaimer }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tpl-scoring-slide-enter-active {
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-scoring-slide-leave-active {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-scoring-fix-btn:not(:disabled):hover {
  border-color: var(--tpl-primary) !important;
  background-color: var(--tpl-primary-light) !important;
}
</style>
