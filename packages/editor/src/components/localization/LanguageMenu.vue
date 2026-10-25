<script setup lang="ts">
import { computed, inject, nextTick, ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { ChevronDown } from "@lucide/vue";
import { defaultLocaleOf, localeCoverage } from "@templatical/types";
import type { BaseEditorReturn } from "../../composables/useEditorCore";
import { useI18n } from "../../composables/useI18n";
import { CUSTOM_BLOCK_DEFINITIONS_KEY } from "../../keys";
import { languageName } from "../../utils/languageName";
import {
  dangerBtnClass,
  secondaryBtnClass,
  secondaryBtnCompactClass,
} from "../../constants/styleConstants";
import TplModal from "../TplModal.vue";

const props = defineProps<{ editor: BaseEditorReturn; locales: string[] }>();
const { t, format } = useI18n();
const definitions = inject(CUSTOM_BLOCK_DEFINITIONS_KEY, []);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const removing = ref<string | null>(null);
const source = computed(() => defaultLocaleOf(props.editor.content.value));
const active = computed(() => props.editor.activeLocale?.value ?? source.value);
const versions = computed(
  () => props.editor.content.value.settings.locales ?? [],
);
const available = computed(() =>
  props.locales.filter(
    (locale) => locale !== source.value && !versions.value.includes(locale),
  ),
);
const editable = computed(
  () => active.value === source.value || props.locales.includes(active.value),
);
function coverage(locale: string) {
  return localeCoverage(props.editor.content.value, locale, definitions);
}
const activeCoverage = computed(() => coverage(active.value));
function select(locale: string) {
  props.editor.setActiveLocale?.(locale === source.value ? null : locale);
  close();
}
function close() {
  open.value = false;
  trigger.value?.focus();
}
async function toggle() {
  open.value = !open.value;
  if (open.value) {
    await nextTick();
    root.value?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
  }
}
function navigate(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const items = Array.from(
    root.value?.querySelectorAll<HTMLButtonElement>(
      '[role^="menuitem"]:not(:disabled)',
    ) ?? [],
  );
  const current = items.indexOf(event.target as HTMLButtonElement);
  const index =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
          items.length;
  items[index]?.focus();
}
function add(locale: string) {
  props.editor.addLocale?.(locale);
  close();
}
function remove() {
  if (removing.value) props.editor.removeLocale?.(removing.value);
  removing.value = null;
  close();
}
onClickOutside(root, () => {
  open.value = false;
});
</script>

<template>
  <div
    ref="root"
    class="tpl:relative tpl:min-w-0 tpl:shrink"
    @keydown="navigate"
  >
    <button
      ref="trigger"
      type="button"
      data-testid="language-menu"
      aria-haspopup="menu"
      :aria-expanded="open"
      :title="languageName(active)"
      :class="secondaryBtnCompactClass"
      style="
        max-width: calc(9 * var(--tpl-base-size));
        min-width: 0;
        width: 100%;
      "
      @click="toggle"
    >
      <span class="tpl:truncate">{{ languageName(active) }}</span>
      <span v-if="active !== source" class="tpl:shrink-0 tpl:tabular-nums"
        >{{ activeCoverage.translated.length }}/{{
          activeCoverage.translated.length +
          activeCoverage.missing.length +
          activeCoverage.stale.length
        }}</span
      >
      <ChevronDown :size="12" class="tpl:shrink-0" />
    </button>
    <div
      v-if="open"
      role="menu"
      :aria-label="t.localization.languages"
      class="tpl:absolute tpl:left-0 tpl:top-full tpl:z-50 tpl:mt-2 tpl:max-h-96 tpl:w-64 tpl:overflow-y-auto tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-2 tpl:shadow-[var(--tpl-shadow-md)]"
    >
      <button
        type="button"
        role="menuitemradio"
        :aria-checked="active === source"
        :data-testid="`language-option-${source}`"
        :class="secondaryBtnClass"
        class="tpl:mb-1 tpl:w-full tpl:justify-between"
        @click="select(source)"
      >
        {{ languageName(source) }} <span>{{ t.localization.default }}</span>
      </button>
      <div v-for="locale in versions" :key="locale" class="tpl:mb-2">
        <button
          type="button"
          role="menuitemradio"
          :aria-checked="active === locale"
          :data-testid="`language-option-${locale}`"
          :class="secondaryBtnClass"
          class="tpl:w-full tpl:flex-col tpl:items-start"
          @click="select(locale)"
        >
          <span>{{ languageName(locale) }}</span>
          <span v-if="!locales.includes(locale)">{{
            t.localization.notEnabled
          }}</span>
          <span>{{
            format(t.localization.notTranslatedCount, {
              count: coverage(locale).missing.length,
            })
          }}</span>
          <span>{{
            format(t.localization.outOfDateCount, {
              count: coverage(locale).stale.length,
            })
          }}</span>
        </button>
        <button
          v-if="locales.includes(locale) && editable"
          type="button"
          role="menuitem"
          :data-testid="`language-remove-${locale}`"
          :class="secondaryBtnClass"
          class="tpl:mt-1 tpl:w-full"
          @click="removing = locale"
        >
          {{
            format(t.localization.removeLanguage, {
              language: languageName(locale),
            })
          }}
        </button>
      </div>
      <template v-if="available.length && editable">
        <p
          class="tpl:my-2 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.localization.addLanguage }}
        </p>
        <button
          v-for="locale in available"
          :key="locale"
          type="button"
          role="menuitem"
          :data-testid="`language-add-${locale}`"
          :class="secondaryBtnClass"
          class="tpl:mb-1 tpl:w-full"
          @click="add(locale)"
        >
          {{ languageName(locale) }}
        </button>
      </template>
    </div>
    <TplModal :visible="removing !== null" @close="removing = null">
      <section
        role="dialog"
        aria-modal="true"
        :aria-label="
          format(t.localization.removeConfirmation, {
            language: languageName(removing ?? source),
          })
        "
        class="tpl:w-80 tpl:max-w-full tpl:max-h-[90%] tpl:overflow-y-auto tpl:box-border tpl:rounded-[var(--tpl-radius)] tpl:bg-[var(--tpl-bg)] tpl:p-5 tpl:shadow-[var(--tpl-shadow-lg)]"
      >
        <p class="tpl:mb-4 tpl:text-sm tpl:text-[var(--tpl-text)]">
          {{
            format(t.localization.removeConfirmation, {
              language: languageName(removing ?? source),
            })
          }}
        </p>
        <div class="tpl:flex tpl:justify-end tpl:gap-2">
          <button
            type="button"
            data-testid="language-remove-cancel"
            :class="secondaryBtnClass"
            @click="removing = null"
          >
            {{ t.localization.cancel }}
          </button>
          <button
            type="button"
            data-testid="language-remove-confirm"
            :class="dangerBtnClass"
            @click="remove"
          >
            {{
              format(t.localization.removeLanguage, {
                language: languageName(removing ?? source),
              })
            }}
          </button>
        </div>
      </section>
    </TplModal>
  </div>
</template>
