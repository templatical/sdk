<script setup lang="ts">
import { chromePillClass } from "../../constants/styleConstants";
import { computed, inject } from "vue";
import { RotateCcw } from "@lucide/vue";
import { deepEqual, generateId, readPath } from "@templatical/types";
import { ghostBtnClass } from "../../constants/styleConstants";
import { EDITOR_KEY } from "../../keys";
import { useI18n } from "../../composables/useI18n";
import { languageName } from "../../utils/languageName";

const actionClass = ghostBtnClass.replace("tpl:text-sm", "tpl:text-xs");

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
const controlId = `tpl-field-${generateId()}`;
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
const language = computed(() =>
  languageName(editor?.activeLocale?.value ?? ""),
);
const description = computed(() =>
  format(t.localization.resetToDefault, {
    default: languageName(editor?.content.value.settings.locale ?? "en"),
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
      v-if="label || $slots.label || isOverridden"
      class="tpl:mb-1.5 tpl:flex tpl:items-center tpl:justify-between tpl:gap-1"
    >
      <div class="tpl:flex tpl:items-center tpl:gap-1.5">
        <label
          v-if="label || $slots.label"
          :for="controlId"
          class="tpl:block tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
          ><slot name="label">{{ label }}</slot></label
        >
        <span
          v-if="isOverridden"
          data-testid="field-locale-pill"
          :class="chromePillClass"
          >{{ language }}</span
        >
      </div>
      <div class="tpl:flex tpl:items-center tpl:gap-1">
        <slot name="label-actions" v-bind="{ controlId }" />
        <button
          v-if="isOverridden"
          type="button"
          data-testid="field-reset"
          :aria-label="description"
          :title="description"
          :class="[actionClass, 'tpl:p-1']"
          @click="reset"
        >
          <RotateCcw :size="12" aria-hidden="true" />
        </button>
      </div>
    </div>
    <slot v-bind="{ controlId }" />
  </div>
</template>
