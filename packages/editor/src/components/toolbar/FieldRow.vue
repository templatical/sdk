<script setup lang="ts">
import { computed, inject } from "vue";
import { RotateCcw } from "@lucide/vue";
import { deepEqual, readPath } from "@templatical/types";
import {
  labelClass,
  secondaryBtnCompactClass,
} from "../../constants/styleConstants";
import { EDITOR_KEY } from "../../keys";
import { useI18n } from "../../composables/useI18n";
import { languageName } from "../../utils/languageName";

const props = withDefaults(
  defineProps<{
    label?: string;
    overridden?: boolean;
    path?: string;
    settings?: boolean;
  }>(),
  { label: undefined, overridden: undefined, path: undefined },
);
const emit = defineEmits<{ (e: "reset"): void }>();
const editor = inject(EDITOR_KEY, null);
const { t, format } = useI18n();
const layer = computed(() => {
  const locale = editor?.activeLocale?.value;
  if (!locale) return undefined;
  return props.settings
    ? editor?.content.value.settings.l10n?.[locale]
    : editor?.selectedBlock?.value?.l10n?.[locale];
});
// A parent override (for example styles.padding) also owns each displayed leaf.
const paths = computed(() =>
  props.path
    ? [
        ...Object.keys(layer.value?.set ?? {}),
        ...Object.keys(layer.value?.text ?? {}),
      ].filter(
        (path) =>
          path === props.path ||
          path.startsWith(`${props.path}.`) ||
          (props.path!.startsWith(`${path}.`) &&
            !deepEqual(
              readPath(
                layer.value?.set?.[path],
                props.path!.slice(path.length + 1),
              ),
              readPath(
                props.settings
                  ? editor?.content.value.settings
                  : editor?.selectedBlock?.value,
                props.path!,
              ),
            )),
      )
    : [],
);
const isOverridden = computed(() => props.overridden ?? paths.value.length > 0);
const description = computed(() =>
  format(t.localization.differs, {
    language: languageName(editor?.activeLocale?.value ?? ""),
  }),
);
function reset() {
  if (props.settings && props.path && editor) {
    const base = editor.content.value.settings;
    editor.updateSettings({ [props.path]: readPath(base, props.path) });
  } else if (props.path && editor?.selectedBlock?.value) {
    editor.resetLocaleFields?.(editor.selectedBlock.value.id, [props.path]);
  }
  emit("reset");
}
</script>

<template>
  <div
    :class="settings ? undefined : 'tpl:mb-3.5'"
    :data-locale-path="
      path ? (settings ? `settings/${path}` : path) : undefined
    "
  >
    <div
      v-if="label || isOverridden"
      class="tpl:flex tpl:items-center tpl:justify-between tpl:gap-1"
    >
      <label v-if="label" :class="labelClass">{{ label }}</label>
      <span
        v-if="isOverridden"
        class="tpl:flex tpl:items-center tpl:gap-1 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
        :title="description"
      >
        <span
          data-testid="field-override-dot"
          aria-hidden="true"
          class="tpl:size-1.5 tpl:rounded-full tpl:bg-[var(--tpl-secondary)]"
        />
        <span v-if="settings">{{ description }}</span>
        <button
          type="button"
          data-testid="field-reset"
          :aria-label="`${t.localization.reset}: ${label ?? path ?? description}`"
          :class="secondaryBtnCompactClass"
          @click="reset"
        >
          <RotateCcw :size="12" />{{ t.localization.reset }}
        </button>
      </span>
    </div>
    <slot />
  </div>
</template>
