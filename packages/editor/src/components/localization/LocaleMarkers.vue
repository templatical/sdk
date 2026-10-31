<script setup lang="ts">
import { computed, inject } from "vue";
import {
  readPath,
  localeCoverage,
  localeStrings,
  SYNTAX_PRESETS,
  TRANSLATABLE_HTML_FIELDS,
  type Block,
  type TemplateContent,
} from "@templatical/types";
import {
  EDITOR_KEY,
  ANCESTOR_HIDDEN_LOCALES_KEY,
  LOCALIZATION_KEY,
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  MERGE_TAG_SYNTAX_KEY,
} from "../../keys";
import { mergeTagsDiffer } from "../../utils/mergeTagTokens";
import LocaleStatusChip from "./LocaleStatusChip.vue";

const props = defineProps<{ block: Block }>();
const editor = inject(EDITOR_KEY, null);
const config = inject(LOCALIZATION_KEY, undefined);
const definitions = inject(CUSTOM_BLOCK_DEFINITIONS_KEY, []);
const syntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
const ancestorHiddenLocales = inject(
  ANCESTOR_HIDDEN_LOCALES_KEY,
  computed<ReadonlySet<string>>(() => new Set()),
);
const locale = computed(() => editor?.activeLocale?.value);
const layer = computed(() =>
  locale.value ? props.block.l10n?.[locale.value] : undefined,
);
// The chip owns this block's fields, never its children or the template's settings.
const scopedContent = computed<TemplateContent>(() => ({
  blocks: [
    props.block.type === "section" || props.block.type === "wrapper"
      ? { ...props.block, children: [] }
      : props.block,
  ],
  settings: {
    locale: editor!.content.value.settings.locale,
    locales: editor!.content.value.settings.locales,
  } as TemplateContent["settings"],
}));
const coverage = computed(() =>
  editor && locale.value && !ancestorHiddenLocales.value.has(locale.value)
    ? localeCoverage(scopedContent.value, locale.value, definitions)
    : { missing: [], stale: [], translated: [] },
);
const stale = computed(() =>
  coverage.value.stale.map((id) => id.slice(props.block.id.length + 1)),
);
// Current translations whose merge tags differ from the default's, as
// `localization.merge-tags-differ` reports them. Stale fields show as stale first.
const tagsDiffer = computed(() =>
  coverage.value.translated.flatMap((id) => {
    const path = id.slice(props.block.id.length + 1);
    const base = readPath(props.block, path);
    const value = layer.value?.text?.[path]?.value;
    const format =
      props.block.type === "html" ||
      TRANSLATABLE_HTML_FIELDS[props.block.type]?.includes(path)
        ? "html"
        : "text";
    return typeof base === "string" &&
      value !== undefined &&
      mergeTagsDiffer(base, value, syntax, format)
      ? [path]
      : [];
  }),
);
const translationStrings = computed(() =>
  editor && locale.value && !ancestorHiddenLocales.value.has(locale.value)
    ? localeStrings(scopedContent.value, locale.value, {
        syntax,
        definitions,
        doNotTranslate: config?.doNotTranslate,
        blockId: props.block.id,
        only: state.value === "tags-differ" ? "all" : "gaps",
      }).strings
    : [],
);
const replacesCurrent = computed(() =>
  translationStrings.value.some(({ id }) => {
    const path = id.slice(props.block.id.length + 1);
    return (
      coverage.value.translated.includes(id) && !tagsDiffer.value.includes(path)
    );
  }),
);
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
const staleLocales = computed(() =>
  !locale.value && editor
    ? (editor.content.value.settings.locales ?? []).filter(
        (tag) =>
          !ancestorHiddenLocales.value.has(tag) &&
          localeCoverage(scopedContent.value, tag, definitions).stale.length >
            0,
      )
    : [],
);
const state = computed(() => {
  if (!locale.value) return staleLocales.value.length ? "default-stale" : null;
  if (ancestorHiddenLocales.value.has(locale.value)) return null;
  if (layer.value?.hidden) return "hidden";
  if (coverage.value.missing.length) return "missing";
  if (stale.value.length) return "stale";
  if (tagsDiffer.value.length) return "tags-differ";
  return setPaths.value.length ? "changed" : null;
});
const count = computed(() =>
  state.value === "missing"
    ? coverage.value.missing.length
    : state.value === "stale"
      ? stale.value.length
      : state.value === "tags-differ"
        ? tagsDiffer.value.length
        : state.value === "default-stale"
          ? staleLocales.value.length
          : setPaths.value.length,
);
const excerpt = computed(() => {
  const value = readPath(props.block, stale.value[0] ?? "");
  if (typeof value !== "string") return "";
  const text = value.split(/<[^>]*>/).join("");
  return Array.from(text).slice(0, 60).join("");
});
</script>

<template>
  <LocaleStatusChip
    v-if="config && state"
    :block-id="block.id"
    :state="state"
    :count="count"
    :stale="stale"
    :tags-differ="tagsDiffer"
    :set-paths="setPaths"
    :stale-locales="staleLocales"
    :excerpt="excerpt"
    :eligible-gaps="translationStrings.length > 0"
    :translation-count="translationStrings.length"
    :replaces-current="replacesCurrent"
    :editable="!!locale && config.locales.includes(locale)"
  />
</template>
