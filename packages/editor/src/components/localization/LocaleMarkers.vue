<script setup lang="ts">
import { computed, inject } from "vue";
import {
  readPath,
  localeCoverage,
  localeStrings,
  SYNTAX_PRESETS,
  type Block,
} from "@templatical/types";
import {
  TRANSLATION_FEATURE_KEY,
  EDITOR_KEY,
  LOCALIZATION_KEY,
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  MERGE_TAG_SYNTAX_KEY,
} from "../../keys";
import { useI18n } from "../../composables/useI18n";
import { languageName } from "../../utils/languageName";
import { secondaryBtnCompactClass } from "../../constants/styleConstants";

const props = defineProps<{ block: Block }>();
const translation = inject(TRANSLATION_FEATURE_KEY, null);
const editor = inject(EDITOR_KEY, null);
const config = inject(LOCALIZATION_KEY, undefined);
const definitions = inject(CUSTOM_BLOCK_DEFINITIONS_KEY, []);
const syntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
const { t, format } = useI18n();
const locale = computed(() => editor?.activeLocale?.value);
const language = computed(() => languageName(locale.value ?? ""));
const layer = computed(() =>
  locale.value ? props.block.l10n?.[locale.value] : undefined,
);
const prefix = computed(() => `${props.block.id}/`);
function fields(locale: string) {
  const result = localeCoverage(editor!.content.value, locale, definitions);
  return {
    missing: result.missing.filter((id) => id.startsWith(prefix.value)),
    stale: result.stale
      .filter((id) => id.startsWith(prefix.value))
      .map((id) => id.slice(prefix.value.length)),
  };
}
const eligibleGaps = computed(() =>
  editor && locale.value
    ? localeStrings(editor.content.value, locale.value, {
        syntax,
        definitions,
        blockId: props.block.id,
        only: "gaps",
      }).strings.length > 0
    : false,
);
const missing = computed(
  () => locale.value && fields(locale.value).missing.length > 0,
);
const stale = computed(() => (locale.value ? fields(locale.value).stale : []));
const setPaths = computed(() =>
  Object.keys(layer.value?.set ?? {}).filter((path) => {
    const segments = path.split(".");
    const key = segments.pop()!;
    const parent = segments.length
      ? readPath(props.block, segments.join("."))
      : props.block;
    return Array.isArray(parent)
      ? readPath(parent, key) !== undefined
      : parent !== undefined;
  }),
);
const defaultStale = computed(
  () =>
    editor?.content.value.settings.locales?.reduce(
      (count, locale) => count + fields(locale).stale.length,
      0,
    ) ?? 0,
);
const editable = computed(
  () => locale.value && config?.locales.includes(locale.value),
);
</script>

<template>
  <div
    v-if="config"
    class="tpl:relative tpl:z-[6] tpl:flex tpl:flex-wrap tpl:items-center tpl:gap-1 tpl:text-xs tpl:text-[var(--tpl-chrome-text)]"
    @click.stop
  >
    <template v-if="locale">
      <span v-if="missing" data-testid="locale-marker-untranslated">{{
        t.localization.notTranslated
      }}</span>
      <button
        v-if="
          missing && eligibleGaps && editable && translation?.isAvailable.value
        "
        type="button"
        data-testid="locale-translate"
        :class="secondaryBtnCompactClass"
        :disabled="!!translation.running.value"
        @click="translation.translate({ only: 'gaps', blockId: block.id })"
      >
        {{ t.localization.translate }}
      </button>
      <span v-if="stale.length" data-testid="locale-marker-stale">
        {{ t.localization.outOfDate }}
        <button
          v-if="eligibleGaps && editable && translation?.isAvailable.value"
          type="button"
          data-testid="locale-retranslate"
          :class="secondaryBtnCompactClass"
          :disabled="!!translation.running.value"
          @click="translation.translate({ only: 'gaps', blockId: block.id })"
        >
          {{ t.localization.retranslate }}
        </button>
        <button
          v-if="editable"
          type="button"
          data-testid="locale-keep"
          :class="secondaryBtnCompactClass"
          @click="editor?.keepTranslations?.(block.id, stale)"
        >
          {{ t.localization.keep }}
        </button>
        <button
          v-if="editable"
          type="button"
          data-testid="locale-use-default"
          :class="secondaryBtnCompactClass"
          @click="editor?.resetLocaleFields?.(block.id, stale)"
        >
          {{ t.localization.useDefault }}
        </button>
      </span>
      <span v-if="setPaths.length" data-testid="locale-marker-differs">
        {{ format(t.localization.differs, { language }) }}
        <button
          v-if="editable"
          type="button"
          data-testid="locale-reset"
          :class="secondaryBtnCompactClass"
          @click="editor?.resetLocaleFields?.(block.id, setPaths)"
        >
          {{ t.localization.reset }}
        </button>
      </span>
      <span v-if="layer?.hidden" data-testid="locale-marker-hidden">
        {{ format(t.localization.hidden, { language }) }}
        <button
          v-if="editable"
          type="button"
          data-testid="locale-show"
          :class="secondaryBtnCompactClass"
          @click="editor?.setBlockHidden?.(block.id, false)"
        >
          {{ t.localization.show }}
        </button>
      </span>
    </template>
    <span v-else-if="defaultStale" data-testid="locale-marker-stale">{{
      format(t.localization.translationsOutOfDate, { count: defaultStale })
    }}</span>
  </div>
</template>
