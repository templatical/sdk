<script setup lang="ts">
import { computed } from "vue";
import { X } from "@lucide/vue";
import type { UseTranslationFeatureReturn } from "../../composables/useTranslationFeature";
import { useI18n } from "../../composables/useI18n";
import { languageName } from "../../utils/languageName";
import { secondaryBtnCompactClass } from "../../constants/styleConstants";

const props = defineProps<{
  feature: UseTranslationFeatureReturn;
  locale: string;
}>();
const { t, format } = useI18n();
const resultText = computed(() => {
  const result = props.feature.lastResult.value;
  if (!result) return "";
  const parts = [
    format(t.localization.translatedFields, { count: result.translated }),
  ];
  if (result.tagsChanged.length)
    parts.push(
      format(t.localization.translationTagsChanged, {
        count: result.tagsChanged.length,
      }),
    );
  if (result.skippedLocked.length)
    parts.push(
      format(t.localization.translationSkippedLocked, {
        count: result.skippedLocked.length,
        language: languageName(props.locale),
      }),
    );
  if (result.missing.length)
    parts.push(
      format(t.localization.translationMissing, {
        count: result.missing.length,
      }),
    );
  if (result.error) parts.push(result.error.message);
  return parts.join(" · ");
});
</script>

<template>
  <div
    v-if="feature.running.value || feature.lastResult.value"
    data-testid="translation-status"
    role="status"
    style="max-width: calc(32 * var(--tpl-base-size))"
    class="tpl:flex tpl:items-center tpl:gap-2 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-1 tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
  >
    <template v-if="feature.running.value">
      <span>{{
        format(t.localization.translating, feature.running.value)
      }}</span>
      <button
        type="button"
        data-testid="translation-cancel"
        :class="secondaryBtnCompactClass"
        @click="feature.cancel()"
      >
        {{ t.localization.cancel }}
      </button>
    </template>
    <template v-else>
      <span data-testid="translation-result">{{ resultText }}</span>
      <button
        type="button"
        data-testid="translation-dismiss"
        :aria-label="t.localization.dismiss"
        :class="secondaryBtnCompactClass"
        @click="feature.dismissResult()"
      >
        <X :size="14" />
      </button>
    </template>
  </div>
</template>
