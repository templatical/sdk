<script setup lang="ts">
import { Check, X } from "@lucide/vue";
import { computed, inject } from "vue";
import { useI18n } from "../../composables/useI18n";
import { TONE_STYLES } from "../../constants/noticeTones";
import { plural } from "../../i18n/plural";
import { UI_LOCALE_KEY } from "../../keys";
import { languageName } from "../../utils/languageName";

export interface LocaleNotice {
  language: string;
  old: string;
  count: number;
}

const props = defineProps<{ notice: LocaleNotice }>();
const emit = defineEmits<{ dismiss: [] }>();
const { t, format } = useI18n();
const uiLocale = inject(UI_LOCALE_KEY, undefined) ?? "en";
const message = computed(() => {
  const { notice } = props;
  const parts = [
    format(t.localization.defaultChanged, {
      language: languageName(notice.language),
    }),
  ];
  if (notice.count)
    parts.push(
      plural(t.localization.defaultRemaining, notice.count, uiLocale, {
        old: languageName(notice.old),
      }),
    );
  return parts.join(" ");
});
</script>

<template>
  <div
    data-testid="locale-notice"
    role="status"
    aria-live="polite"
    class="tpl:pointer-events-auto tpl:flex tpl:items-center tpl:gap-3 tpl:rounded-[var(--tpl-radius)] tpl:px-4 tpl:py-2.5 tpl:text-sm tpl:shadow-[var(--tpl-shadow-lg)]"
    :style="TONE_STYLES.info"
  >
    <Check :size="14" aria-hidden="true" class="tpl:shrink-0" />
    <span>{{ message }}</span>
    <button
      type="button"
      class="tpl:flex tpl:size-5 tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded tpl:text-[var(--tpl-text-muted)] tpl:hover:text-[var(--tpl-text)] tpl:focus-visible:outline-none tpl:focus-visible:shadow-[var(--tpl-ring)]"
      :aria-label="t.localization.dismiss"
      :title="t.localization.dismiss"
      @click="emit('dismiss')"
    >
      <X :size="14" :stroke-width="2" aria-hidden="true" />
    </button>
  </div>
</template>
