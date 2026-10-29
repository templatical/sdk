<script lang="ts">
const seenTemplates = new Set<string>();
</script>
<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { Languages, X } from "@lucide/vue";
import { defaultLocaleOf } from "@templatical/types";
import type { BaseEditorReturn } from "../../composables/useEditorCore";
import type { UseTranslationFeatureReturn } from "../../composables/useTranslationFeature";
import { useI18n } from "../../composables/useI18n";
import { useActiveLocaleCoverage } from "../../composables/useLocalizedDisplay";
import {
  ACTIVE_LOCALE_COVERAGE_KEY,
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  UI_LOCALE_KEY,
} from "../../keys";
import { plural } from "../../i18n/plural";
import { languageName } from "../../utils/languageName";
import {
  ghostBtnCompactClass,
  primaryBtnClass,
  primaryBtnCompactClass,
  secondaryBtnClass,
} from "../../constants/styleConstants";
import TplModal from "../TplModal.vue";

const props = defineProps<{
  editor: BaseEditorReturn;
  locales: string[];
  feature: UseTranslationFeatureReturn | null;
  change: number;
}>();
const { t, format } = useI18n();
const uiLocale = inject(UI_LOCALE_KEY, undefined) ?? "en";
const definitions = inject(CUSTOM_BLOCK_DEFINITIONS_KEY, []);
const source = computed(() => defaultLocaleOf(props.editor.content.value));
const active = computed(() => props.editor.activeLocale?.value ?? source.value);
const enabled = computed(() => props.locales.includes(active.value));
// The editor shares one pass with the header trigger; a standalone bar
// computes its own.
const coverage =
  inject(ACTIVE_LOCALE_COVERAGE_KEY, null) ??
  useActiveLocaleCoverage(props.editor, definitions);
const status = computed(() => {
  if (!enabled.value)
    return format(t.localization.languageReadOnly, {
      language: languageName(active.value),
    });
  if (!coverage.value?.missing.length && !coverage.value?.stale.length)
    return t.localization.complete;
  return format(t.localization.gapTooltip, {
    missing: coverage.value.missing.length,
    stale: coverage.value.stale.length,
  });
});
const resultText = computed(() => {
  const result = props.feature?.lastResult.value;
  if (!result) return "";
  const parts = [
    plural(t.localization.translatedFields, result.translated, uiLocale),
  ];
  if (result.tagsChanged.length)
    parts.push(
      plural(
        t.localization.translationTagsChanged,
        result.tagsChanged.length,
        uiLocale,
      ),
    );
  if (result.skippedLocked.length)
    parts.push(
      plural(
        t.localization.translationSkippedLocked,
        result.skippedLocked.length,
        uiLocale,
      ),
    );
  if (result.missing.length)
    parts.push(
      plural(
        t.localization.translationMissing,
        result.missing.length,
        uiLocale,
      ),
    );
  if (result.error)
    parts.push(
      format(t.localization.translationError, {
        message: result.error.message,
      }),
    );
  return parts.join(" ");
});

const structureVisible = ref(false);
let seenMount = false;
const confirming = ref<{
  locale: string;
  templateId: string | null;
  loadVersion: number | undefined;
} | null>(null);
const allAgain = ref<HTMLButtonElement | null>(null);
const allCount = computed(() => props.feature?.counts.value.all ?? 0);
const confirmationTitle = computed(() =>
  plural(t.localization.translationConfirmation, allCount.value, uiLocale),
);
function closeConfirmation() {
  confirming.value = null;
  void nextTick(() => allAgain.value?.focus());
}
function startConfirmation() {
  confirming.value = {
    locale: active.value,
    templateId: props.editor.state.template?.id ?? null,
    loadVersion: props.editor.loadVersion?.value,
  };
}
function confirm() {
  const captured = confirming.value;
  if (
    captured &&
    captured.locale === active.value &&
    captured.templateId === (props.editor.state.template?.id ?? null) &&
    captured.loadVersion === props.editor.loadVersion?.value &&
    enabled.value &&
    props.feature?.isAvailable.value &&
    !props.feature.running.value &&
    allCount.value > 0
  )
    void props.feature.translate({ only: "all" });
  closeConfirmation();
}
watch(
  [
    () => props.editor.state.template?.id,
    () => props.editor.loadVersion?.value,
  ],
  () => {
    structureVisible.value = false;
    if (confirming.value) closeConfirmation();
  },
  { flush: "sync" },
);
watch(active, () => {
  if (confirming.value) closeConfirmation();
});
watch(
  () => props.change,
  () => {
    const templateId = props.editor.state.template?.id;
    if (templateId ? seenTemplates.has(templateId) : seenMount) return;
    if (templateId) seenTemplates.add(templateId);
    else seenMount = true;
    structureVisible.value = true;
  },
);
</script>

<template>
  <div
    v-if="active !== source"
    data-testid="language-bar"
    class="tpl:border-b tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:px-4 tpl:py-2 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
  >
    <div
      class="tpl:flex tpl:flex-wrap tpl:items-center tpl:justify-between tpl:gap-x-6 tpl:gap-y-2"
    >
      <!-- A 16-unit basis keeps the label and status on one line each; on a
           narrow editor the actions wrap to their own row instead. -->
      <div
        class="tpl:flex tpl:min-w-0 tpl:grow tpl:basis-64 tpl:flex-wrap tpl:items-center tpl:gap-x-3 tpl:gap-y-1"
      >
        <span
          data-testid="language-bar-label"
          class="tpl:inline-flex tpl:items-center tpl:gap-2 tpl:font-medium tpl:whitespace-nowrap tpl:text-[var(--tpl-text)]"
        >
          <Languages :size="14" aria-hidden="true" class="tpl:shrink-0" />
          {{
            format(t.localization.editingLanguage, {
              language: languageName(active),
            })
          }}
        </span>
        <span
          data-testid="language-bar-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          class="tpl:whitespace-nowrap"
        >
          <template v-if="feature?.running.value">{{
            format(t.localization.translating, feature.running.value)
          }}</template>
          <!-- A result can run to a provider's whole message, so it wraps. -->
          <span
            v-else-if="feature?.lastResult.value"
            data-testid="translation-result"
            class="tpl:whitespace-normal"
            >{{ resultText }}</span
          >
          <template v-else>{{ status }}</template>
        </span>
        <button
          v-if="feature?.lastResult.value && !feature.running.value"
          type="button"
          data-testid="translation-dismiss"
          :aria-label="t.localization.dismiss"
          :class="ghostBtnCompactClass"
          @click="feature.dismissResult()"
        >
          <X :size="14" aria-hidden="true" />
        </button>
      </div>
      <div class="tpl:flex tpl:flex-wrap tpl:items-center tpl:gap-2">
        <button
          v-if="feature?.running.value"
          type="button"
          data-testid="translation-cancel"
          :class="ghostBtnCompactClass"
          @click="feature.cancel()"
        >
          {{ t.localization.cancel }}
        </button>
        <template v-if="enabled && feature?.isAvailable.value">
          <button
            v-if="feature.counts.value.gaps > 0"
            type="button"
            data-testid="translate-language"
            :class="primaryBtnCompactClass"
            :disabled="!!feature.running.value"
            @click="feature.translate({ only: 'gaps' })"
          >
            {{
              plural(
                t.localization.translateFields,
                feature.counts.value.gaps,
                uiLocale,
              )
            }}
          </button>
          <button
            ref="allAgain"
            type="button"
            data-testid="translate-all-again"
            :class="ghostBtnCompactClass"
            :disabled="!!feature.running.value || allCount === 0"
            @click="startConfirmation"
          >
            {{ t.localization.translateAllAgain }}
          </button>
        </template>
        <button
          type="button"
          data-testid="language-back-default"
          :class="ghostBtnCompactClass"
          @click="editor.setActiveLocale?.(null)"
        >
          {{
            format(t.localization.backToDefault, {
              default: languageName(source),
            })
          }}
        </button>
      </div>
    </div>
    <div
      v-if="structureVisible"
      data-testid="structure-notice"
      role="status"
      class="tpl:mt-1 tpl:flex tpl:items-center tpl:gap-2"
    >
      <span>{{ t.localization.structureNotice }}</span>
      <button
        type="button"
        :aria-label="t.localization.dismiss"
        :class="ghostBtnCompactClass"
        @click="structureVisible = false"
      >
        <X :size="14" aria-hidden="true" />
      </button>
    </div>
    <TplModal :visible="confirming !== null" @close="closeConfirmation">
      <section
        role="dialog"
        aria-modal="true"
        :aria-label="confirmationTitle"
        class="tpl:w-96 tpl:max-w-full tpl:max-h-[90%] tpl:overflow-y-auto tpl:box-border tpl:rounded-[var(--tpl-radius)] tpl:bg-[var(--tpl-bg)] tpl:p-5 tpl:shadow-[var(--tpl-shadow-lg)]"
      >
        <h3
          class="tpl:m-0 tpl:mb-4 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{ confirmationTitle }}
        </h3>
        <p class="tpl:mb-4 tpl:text-sm tpl:text-[var(--tpl-text-muted)]">
          {{
            format(t.localization.translationDescription, {
              language: languageName(confirming?.locale ?? active),
            })
          }}
        </p>
        <div class="tpl:flex tpl:flex-wrap tpl:justify-end tpl:gap-2">
          <button
            type="button"
            data-testid="translation-confirm-cancel"
            :class="secondaryBtnClass"
            @click="closeConfirmation"
          >
            {{ t.localization.cancel }}
          </button>
          <button
            type="button"
            data-testid="translation-confirm"
            :class="primaryBtnClass"
            :disabled="
              !!feature?.running.value ||
              !feature?.isAvailable.value ||
              allCount === 0
            "
            @click="confirm"
          >
            {{ plural(t.localization.translateAllFields, allCount, uiLocale) }}
          </button>
        </div>
      </section>
    </TplModal>
  </div>
</template>
