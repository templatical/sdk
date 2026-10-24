<script setup lang="ts">
import type { Editor } from "@tiptap/core";
import {
  SdkError,
  SYNTAX_PRESETS,
  type AiRewritePreset,
} from "@templatical/types";
import { Languages, Sparkles, Square, WandSparkles, X } from "@lucide/vue";
import { computed, inject, onBeforeUnmount, ref } from "vue";
import ToolbarSelect from "../toolbar/ToolbarSelect.vue";
import { useI18n } from "../../composables/useI18n";
import {
  primaryBtnCompactClass,
  secondaryBtnCompactClass,
} from "../../constants/styleConstants";
import {
  AI_FEATURE_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  NO_MERGE_TAGS,
  UI_LOCALE_KEY,
  requireInject,
} from "../../keys";
import { aiErrorMessage } from "../../utils/aiErrors";
import {
  htmlToPlainText,
  rewriteLanguageOptions,
} from "../../utils/aiRewritePreview";
import { normalizeMergeTagsInHtml } from "../../utils/normalizeMergeTagMarkup";
import { sanitizeRichTextHtml } from "../../utils/sanitizeRichTextHtml";

/**
 * Rewrite with AI, in the paragraph text toolbar: a preset or the user's own
 * instruction, streamed into a preview labelled as an AI suggestion. Replace
 * puts it into the paragraph through TipTap, so it is the user's own edit
 * (an ordinary change, on the normal undo stack, a normal batch with
 * collaboration). Rendered inside `.tpl-text-toolbar` and never teleported:
 * the paragraph leaves edit mode on a mousedown outside the toolbar.
 */
const props = defineProps<{ editor: Editor }>();

const { t, format } = useI18n();
const feature = requireInject(AI_FEATURE_KEY, "AiRewriteMenu");
const mergeTags = inject(MERGE_TAGS_KEY, NO_MERGE_TAGS);
const syntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
const uiLocale = inject(UI_LOCALE_KEY, undefined);

const PRESETS: Exclude<AiRewritePreset, "translate">[] = [
  "shorten",
  "expand",
  "friendlier",
  "formal",
  "fixGrammar",
];
const languages = rewriteLanguageOptions(uiLocale);

const isOpen = ref(false);
const language = ref(languages[0].value);
const instruction = ref("");
const isRewriting = ref(false);
const streamed = ref("");
const raw = ref<string | null>(null);
const failure = ref<unknown>(null);
let controller: AbortController | null = null;
let generation = 0;

/** The finished rewrite as the editor will hold it: tags, then sanitized (D22). */
const result = computed(() =>
  raw.value === null
    ? null
    : sanitizeRichTextHtml(
        normalizeMergeTagsInHtml(raw.value, mergeTags.value, syntax),
      ),
);
const streamingPreview = computed(() => htmlToPlainText(streamed.value));
const errorText = computed(() =>
  failure.value
    ? aiErrorMessage(failure.value, t.ai.errors, format, uiLocale)
    : "",
);

function stop(): void {
  generation++;
  const activeController = controller;
  controller = null;
  isRewriting.value = false;
  activeController?.abort();
}

function reset(): void {
  stop();
  streamed.value = "";
  raw.value = null;
  failure.value = null;
}

function close(): void {
  reset();
  isOpen.value = false;
}

function toggle(): void {
  if (isOpen.value) close();
  else isOpen.value = true;
}

async function run(preset: AiRewritePreset | null): Promise<void> {
  const text = instruction.value.trim();
  if (
    isRewriting.value ||
    (preset === null && text === "") ||
    (preset === "translate" && language.value === "")
  )
    return;
  reset();
  const html = props.editor.getHTML();
  if (Array.from(html).length > 20_000) {
    failure.value = new SdkError(t.ai.rewrite.tooLarge, 413);
    return;
  }
  const requestController = new AbortController();
  const token = ++generation;
  controller = requestController;
  isRewriting.value = true;
  try {
    const answer = await feature.rewrite(
      {
        html,
        preset,
        language: preset === "translate" ? language.value : null,
        instruction: text === "" ? null : text,
      },
      (chunk) => {
        if (token !== generation) return;
        streamed.value += chunk;
      },
      requestController.signal,
    );
    if (token !== generation) return;
    raw.value = answer.html;
  } catch (error) {
    if (
      token === generation &&
      !(error instanceof Error && error.name === "AbortError")
    )
      failure.value = error;
  } finally {
    if (token === generation) {
      isRewriting.value = false;
      controller = null;
    }
  }
}

function replace(): void {
  if (result.value === null) return;
  props.editor
    .chain()
    .focus()
    .setContent(result.value, { emitUpdate: true })
    .run();
  close();
}

onBeforeUnmount(stop);
</script>

<template>
  <div class="tpl:relative tpl:flex tpl:items-center">
    <button
      type="button"
      data-testid="ai-rewrite-trigger"
      class="tpl:flex tpl:h-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded tpl:border-none tpl:bg-transparent tpl:px-2.5 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-primary)] tpl:transition-all tpl:hover:bg-[var(--tpl-bg-active)]"
      :aria-label="t.ai.rewrite.title"
      :title="t.ai.rewrite.title"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <Sparkles :size="16" :stroke-width="2" aria-hidden="true" />
      {{ t.ai.menu.button }}
    </button>

    <div
      v-if="isOpen"
      role="dialog"
      :aria-label="t.ai.rewrite.title"
      data-testid="ai-rewrite-panel"
      class="tpl-ai-rewrite-panel tpl:absolute tpl:top-full tpl:right-0 tpl:z-50 tpl:mt-2 tpl:flex tpl:w-80 tpl:flex-col tpl:gap-3 tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-3 tpl:shadow-[var(--tpl-shadow-lg)]"
    >
      <div class="tpl:flex tpl:items-center tpl:justify-between">
        <span
          class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-primary)]"
        >
          <WandSparkles :size="14" :stroke-width="2" aria-hidden="true" />
          {{ t.ai.rewrite.title }}
        </span>
        <button
          type="button"
          class="tpl:rounded-md tpl:p-0.5 tpl:text-[var(--tpl-text-muted)]"
          :aria-label="t.ai.rewrite.close"
          :title="t.ai.rewrite.close"
          @click="close"
        >
          <X :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>

      <!-- The finished rewrite: normalized and sanitized, labelled (Art. 50). -->
      <template v-if="result !== null">
        <span
          data-testid="ai-rewrite-label"
          class="tpl:self-start tpl:rounded tpl:px-1.5 tpl:py-px tpl:text-[10px] tpl:font-medium tpl:bg-[var(--tpl-secondary-light)] tpl:text-[var(--tpl-text)]"
        >
          {{ t.ai.rewrite.suggestionLabel }}
        </span>
        <div
          data-testid="ai-rewrite-preview"
          class="tpl:max-h-48 tpl:overflow-y-auto tpl:text-sm tpl:text-[var(--tpl-text)]"
          v-html="result"
        />
        <div class="tpl:flex tpl:justify-end tpl:gap-2">
          <button
            type="button"
            data-testid="ai-rewrite-discard"
            :class="secondaryBtnCompactClass"
            @click="reset"
          >
            {{ t.ai.rewrite.discard }}
          </button>
          <button
            type="button"
            data-testid="ai-rewrite-replace"
            :class="primaryBtnCompactClass"
            @click="replace"
          >
            {{ t.ai.rewrite.replaceAction }}
          </button>
        </div>
      </template>

      <!-- Streaming: plain text only. -->
      <template v-else-if="isRewriting">
        <span
          data-testid="ai-rewrite-label"
          class="tpl:self-start tpl:rounded tpl:px-1.5 tpl:py-px tpl:text-[10px] tpl:font-medium tpl:bg-[var(--tpl-secondary-light)] tpl:text-[var(--tpl-text)]"
        >
          {{ t.ai.rewrite.suggestionLabel }}
        </span>
        <p
          data-testid="ai-rewrite-preview"
          class="tpl:m-0 tpl:max-h-48 tpl:overflow-y-auto tpl:whitespace-pre-wrap tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
        >
          {{ streamingPreview || t.ai.rewrite.rewriting }}
        </p>
        <button
          type="button"
          data-testid="ai-rewrite-stop"
          :class="[secondaryBtnCompactClass, 'tpl:self-end']"
          @click="stop"
        >
          <Square :size="12" :stroke-width="2" aria-hidden="true" />
          {{ t.ai.rewrite.stop }}
        </button>
      </template>

      <template v-else>
        <div class="tpl:flex tpl:flex-wrap tpl:gap-1.5">
          <button
            v-for="preset in PRESETS"
            :key="preset"
            type="button"
            :data-testid="`ai-rewrite-preset-${preset}`"
            :class="secondaryBtnCompactClass"
            @click="run(preset)"
          >
            {{ t.ai.rewrite.presets[preset] }}
          </button>
        </div>
        <div class="tpl:flex tpl:items-center tpl:gap-2">
          <Languages
            :size="14"
            :stroke-width="2"
            class="tpl:shrink-0 tpl:text-[var(--tpl-text-muted)]"
            aria-hidden="true"
          />
          <ToolbarSelect
            v-model="language"
            :options="languages"
            :label="t.ai.rewrite.language"
            width-class="tpl:flex-1"
          />
          <button
            type="button"
            data-testid="ai-rewrite-preset-translate"
            :class="secondaryBtnCompactClass"
            :disabled="language === ''"
            @click="run('translate')"
          >
            {{ t.ai.rewrite.presets.translate }}
          </button>
        </div>
        <div class="tpl:flex tpl:items-end tpl:gap-2">
          <textarea
            v-model="instruction"
            data-testid="ai-rewrite-instruction"
            maxlength="500"
            rows="2"
            class="tpl:flex-1 tpl:resize-none tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2 tpl:py-1.5 tpl:font-sans tpl:text-sm tpl:text-[var(--tpl-text)]"
            :aria-label="t.ai.rewrite.instructionLabel"
            :placeholder="t.ai.rewrite.instructionPlaceholder"
          />
          <button
            type="button"
            data-testid="ai-rewrite-run"
            :class="primaryBtnCompactClass"
            :disabled="instruction.trim() === ''"
            @click="run(null)"
          >
            {{ t.ai.rewrite.run }}
          </button>
        </div>
        <p
          v-if="errorText"
          role="alert"
          data-testid="ai-rewrite-error"
          class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
        >
          {{ errorText }}
        </p>
        <p class="tpl:m-0 tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]">
          {{ t.ai.chat.disclaimer }}
        </p>
      </template>
    </div>
  </div>
</template>
