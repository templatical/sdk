<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { onClickOutside } from "@vueuse/core";
import {
  AlertTriangle,
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Plus,
  Trash2,
} from "@lucide/vue";
import {
  defaultLocaleGaps,
  defaultLocaleOf,
  generateId,
  localeCoverage,
  localeHiddenBlocks,
} from "@templatical/types";
import type { BaseEditorReturn } from "../../composables/useEditorCore";
import { useI18n } from "../../composables/useI18n";
import { useActiveLocaleCoverage } from "../../composables/useLocalizedDisplay";
import {
  ACTIVE_LOCALE_COVERAGE_KEY,
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  LOCALE_ACTIONS_KEY,
  UI_LOCALE_KEY,
} from "../../keys";
import { plural } from "../../i18n/plural";
import { languageName } from "../../utils/languageName";
import {
  dangerBtnClass,
  primaryBtnClass,
  secondaryBtnClass,
  secondaryBtnCompactClass,
  chromePillClass,
} from "../../constants/styleConstants";
import TplModal from "../TplModal.vue";

const props = defineProps<{ editor: BaseEditorReturn; locales: string[] }>();
const { t, format } = useI18n();
const uiLocale = inject(UI_LOCALE_KEY, undefined) ?? "en";
const localeActions = inject(LOCALE_ACTIONS_KEY, null);
const definitions = inject(CUSTOM_BLOCK_DEFINITIONS_KEY, []);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const reasonId = `tpl-language-reason-${generateId()}`;
const open = ref(false);
const submenu = ref<string | null>(null);
const removing = ref<string | null>(null);
const promoting = ref<{ locale: string } | null>(null);
const promotionError = ref<string | null>(null);
const confirmation = ref<{
  templateId: string | null;
  loadVersion: number | undefined;
} | null>(null);
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
// The editor shares one pass with the language bar; a standalone menu
// computes its own.
const activeCoverage =
  inject(ACTIVE_LOCALE_COVERAGE_KEY, null) ??
  useActiveLocaleCoverage(props.editor, definitions);
const rows = computed(() =>
  open.value
    ? [source.value, ...versions.value].map((locale) => ({
        locale,
        coverage:
          locale === source.value
            ? null
            : locale === active.value
              ? activeCoverage.value
              : localeCoverage(props.editor.content.value, locale, definitions),
      }))
    : [],
);
const submenuHiddenBlocks = computed(() =>
  submenu.value &&
  versions.value.includes(submenu.value) &&
  editable.value &&
  props.locales.includes(submenu.value)
    ? localeHiddenBlocks(props.editor.content.value, submenu.value)
    : [],
);
// Make default turns the current default into a version; one outside
// `localization.locales` would be read-only and couldn't be promoted back.
const defaultEnabled = computed(() => props.locales.includes(source.value));
const promotionBlocked = computed(
  () => submenuHiddenBlocks.value.length > 0 || !defaultEnabled.value,
);
const gapCount = computed(
  () =>
    (activeCoverage.value?.missing.length ?? 0) +
    (activeCoverage.value?.stale.length ?? 0),
);
const triggerTitle = computed(() =>
  gapCount.value
    ? format(t.localization.gapTooltip, {
        missing: activeCoverage.value!.missing.length,
        stale: activeCoverage.value!.stale.length,
      })
    : languageName(active.value),
);
const rowClass =
  "tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:border-0 tpl:bg-transparent tpl:px-3 tpl:py-2.5 tpl:text-left tpl:text-xs tpl:transition-colors tpl:focus-visible:outline-none tpl:focus-visible:shadow-[var(--tpl-ring)] tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50";
const surfaceClass =
  "tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)] tpl:shadow-[var(--tpl-shadow-md)]";

function status(
  coverage: NonNullable<(typeof rows.value)[number]["coverage"]>,
) {
  const parts: string[] = [];
  if (coverage.missing.length)
    parts.push(
      plural(t.localization.missingCount, coverage.missing.length, uiLocale),
    );
  if (coverage.stale.length)
    parts.push(
      plural(t.localization.staleCount, coverage.stale.length, uiLocale),
    );
  return parts.join(" · ") || t.localization.complete;
}
function close() {
  open.value = false;
  submenu.value = null;
  void nextTick(() => trigger.value?.focus());
}
async function toggle() {
  if (open.value) {
    close();
    return;
  }
  open.value = true;
  await nextTick();
  root.value?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
}
async function openSubmenu(value: string) {
  submenu.value = submenu.value === value ? null : value;
  await nextTick();
  root.value
    ?.querySelector<HTMLElement>(
      '[data-language-submenu] [role="menuitem"]:not(:disabled)',
    )
    ?.focus();
}
function closeSubmenu() {
  const previous = submenu.value;
  submenu.value = null;
  root.value
    ?.querySelector<HTMLElement>(
      `[data-testid="${previous === "add" ? "language-add" : `language-actions-${previous}`}"]`,
    )
    ?.focus();
}
function navigate(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('[role="dialog"]')) return;
  if (event.key === "Escape" || (event.key === "ArrowLeft" && submenu.value)) {
    event.preventDefault();
    event.stopPropagation();
    if (submenu.value) closeSubmenu();
    else close();
    return;
  }
  if (
    target === trigger.value &&
    ["ArrowDown", "ArrowUp"].includes(event.key)
  ) {
    event.preventDefault();
    if (!open.value) void toggle();
    return;
  }
  if (
    event.key === "ArrowRight" &&
    !target.closest("[data-language-submenu]")
  ) {
    const id = target.dataset.testid ?? "";
    const locale = id.replace(/^language-(option|actions)-/, "");
    if (
      id === "language-add" ||
      (locale !== source.value &&
        editable.value &&
        props.locales.includes(locale))
    ) {
      event.preventDefault();
      void openSubmenu(id === "language-add" ? "add" : locale);
    }
    return;
  }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const menu = target.closest('[role="menu"]');
  const items = Array.from(
    menu?.querySelectorAll<HTMLButtonElement>(
      '[role^="menuitem"]:not(:disabled)',
    ) ?? [],
  ).filter((item) => item.closest('[role="menu"]') === menu);
  const current = items.indexOf(target as HTMLButtonElement);
  const index =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
          items.length;
  items[index]?.focus();
}
function select(locale: string) {
  props.editor.setActiveLocale?.(locale === source.value ? null : locale);
  close();
}
function add(locale: string) {
  if (!editable.value || !available.value.includes(locale)) return;
  props.editor.addLocale?.(locale);
  close();
}
function captureConfirmation() {
  promotionError.value = null;
  confirmation.value = {
    templateId: props.editor.state.template?.id ?? null,
    loadVersion: props.editor.loadVersion?.value,
  };
}
function isCurrentConfirmation() {
  return (
    confirmation.value !== null &&
    confirmation.value.templateId ===
      (props.editor.state.template?.id ?? null) &&
    confirmation.value.loadVersion === props.editor.loadVersion?.value
  );
}
function startRemove(locale: string) {
  captureConfirmation();
  removing.value = locale;
  submenu.value = null;
}
function startPromotion(locale: string) {
  if (
    !defaultEnabled.value ||
    localeHiddenBlocks(props.editor.content.value, locale).length
  )
    return;
  captureConfirmation();
  promoting.value = { locale };
  submenu.value = null;
}
const promotionCount = computed(() =>
  promoting.value
    ? defaultLocaleGaps(
        props.editor.content.value,
        promoting.value.locale,
        definitions,
      ).length
    : 0,
);
const confirmationTitle = computed(() => {
  if (promoting.value)
    return format(t.localization.makeDefaultConfirmation, {
      language: languageName(promoting.value.locale),
    });
  return format(t.localization.removeConfirmation, {
    language: languageName(removing.value ?? source.value),
  });
});
function closeConfirmation() {
  const locale = promoting.value?.locale ?? removing.value;
  confirmation.value = null;
  promotionError.value = null;
  promoting.value = null;
  removing.value = null;
  void nextTick(() => {
    if (!open.value) {
      trigger.value?.focus();
      return;
    }
    const id = `language-actions-${locale}`;
    root.value?.querySelector<HTMLElement>(`[data-testid="${id}"]`)?.focus();
  });
}
function confirm() {
  if (!isCurrentConfirmation()) {
    closeConfirmation();
    close();
    return;
  }
  if (!editable.value) return;
  if (promoting.value) {
    const locale = promoting.value.locale;
    if (
      !props.locales.includes(locale) ||
      !defaultEnabled.value ||
      localeHiddenBlocks(props.editor.content.value, locale).length
    )
      return;
    const result = localeActions?.setDefaultLocale(locale);
    if (!result) return;
    if (!result.applied) {
      promotionError.value = format(t.localization.defaultRefused, {
        language: languageName(locale),
        reason:
          result.error.code === "locked_by_others" ||
          result.error.code === "lock_held"
            ? t.localization.defaultLockedReason
            : result.error.message,
      });
      return;
    }
  } else if (removing.value && props.locales.includes(removing.value))
    props.editor.removeLocale?.(removing.value);
  closeConfirmation();
  close();
}
watch(
  [
    () => props.editor.state.template?.id ?? null,
    () => props.editor.loadVersion?.value,
  ],
  () => {
    if (open.value || confirmation.value !== null) {
      closeConfirmation();
      close();
    }
  },
  { flush: "sync" },
);
onClickOutside(root, () => {
  open.value = false;
  submenu.value = null;
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
      :title="triggerTitle"
      :aria-label="`${languageName(active)} (${active})`"
      :class="secondaryBtnCompactClass"
      class="tpl-language-trigger"
      style="
        max-width: calc(9 * var(--tpl-base-size));
        min-width: 0;
        width: 100%;
      "
      @click="toggle"
    >
      <span class="tpl-language-name tpl:truncate">{{
        languageName(active)
      }}</span>
      <span class="tpl-language-tag tpl:truncate" aria-hidden="true">{{
        active
      }}</span>
      <template v-if="gapCount">
        <AlertTriangle
          :size="12"
          aria-hidden="true"
          class="tpl:shrink-0 tpl:text-[var(--tpl-warning)]"
        />
        <span class="tpl-language-count tpl:shrink-0 tpl:tabular-nums">{{
          gapCount
        }}</span>
      </template>
      <ChevronDown
        :size="12"
        aria-hidden="true"
        class="tpl-language-chevron tpl:shrink-0"
      />
    </button>
    <div
      v-if="open"
      role="menu"
      :aria-label="t.localization.languages"
      :class="surfaceClass"
      class="tpl:absolute tpl:left-0 tpl:top-full tpl:z-50 tpl:mt-2 tpl:w-72"
    >
      <div
        class="tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-semibold tpl:text-[var(--tpl-text)]"
      >
        {{ t.localization.languages }}
      </div>
      <div class="tpl:max-h-64 tpl:overflow-y-auto">
        <div
          v-for="row in rows"
          :key="row.locale"
          class="tpl-language-row tpl:flex tpl:items-center"
          :data-active="active === row.locale"
        >
          <button
            type="button"
            role="menuitemradio"
            :aria-checked="active === row.locale"
            :data-testid="`language-option-${row.locale}`"
            :class="rowClass"
            @click="select(row.locale)"
          >
            <span class="tpl:flex tpl:w-3 tpl:shrink-0"
              ><Check
                v-if="active === row.locale"
                :size="12"
                aria-hidden="true"
            /></span>
            <span class="tpl:flex tpl:min-w-0 tpl:flex-col tpl:gap-0.5">
              <span class="tpl:flex tpl:items-center tpl:gap-2">
                <span>{{ languageName(row.locale) }}</span>
                <span
                  v-if="row.locale === source || !locales.includes(row.locale)"
                  class="tpl-language-pill"
                  :class="chromePillClass"
                  >{{
                    row.locale === source
                      ? t.localization.default
                      : t.localization.notEnabled
                  }}</span
                >
              </span>
              <span
                v-if="row.coverage"
                :data-testid="`language-status-${row.locale}`"
                class="tpl:flex tpl:items-center tpl:gap-1 tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
              >
                <AlertTriangle
                  v-if="
                    row.coverage.missing.length || row.coverage.stale.length
                  "
                  :size="10"
                  aria-hidden="true"
                  class="tpl:text-[var(--tpl-warning)]"
                />
                <Check
                  v-else
                  :size="10"
                  aria-hidden="true"
                  class="tpl:text-[var(--tpl-success)]"
                />
                {{ status(row.coverage) }}
              </span>
            </span>
          </button>
          <button
            v-if="
              row.locale !== source && editable && locales.includes(row.locale)
            "
            type="button"
            :data-testid="`language-actions-${row.locale}`"
            aria-haspopup="menu"
            :aria-expanded="submenu === row.locale"
            :aria-label="
              format(t.localization.moreActions, {
                language: languageName(row.locale),
              })
            "
            class="tpl-language-actions tpl:mr-2 tpl:flex tpl:size-7 tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-0 tpl:bg-transparent tpl:text-[var(--tpl-text-muted)] tpl:transition-colors tpl:hover:bg-[var(--tpl-bg-hover)] tpl:focus-visible:outline-none tpl:focus-visible:shadow-[var(--tpl-ring)]"
            @click="openSubmenu(row.locale)"
          >
            <Ellipsis :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        v-for="row in rows.filter(
          (item) =>
            item.locale === submenu &&
            editable &&
            locales.includes(item.locale),
        )"
        :key="row.locale"
        role="menu"
        data-language-submenu
        :aria-label="
          format(t.localization.moreActions, {
            language: languageName(row.locale),
          })
        "
        :class="surfaceClass"
        class="tpl-language-submenu tpl:absolute tpl:left-full tpl:top-0 tpl:ml-1 tpl:w-64 tpl:overflow-hidden"
      >
        <button
          type="button"
          role="menuitem"
          :data-testid="`language-make-default-${row.locale}`"
          :class="rowClass"
          :aria-disabled="promotionBlocked"
          :aria-label="t.localization.makeDefaultLanguage"
          :aria-describedby="promotionBlocked ? reasonId : undefined"
          @click="startPromotion(row.locale)"
        >
          <ArrowUpToLine :size="14" aria-hidden="true" class="tpl:shrink-0" />
          <span class="tpl:flex tpl:min-w-0 tpl:flex-col tpl:gap-1">
            <span>{{ t.localization.makeDefaultLanguage }}</span>
            <span
              v-if="promotionBlocked"
              :id="reasonId"
              class="tpl:text-[10px] tpl:text-[var(--tpl-text-muted)]"
            >
              {{
                !defaultEnabled
                  ? format(t.localization.defaultNotEnabled, {
                      default: languageName(source),
                    })
                  : plural(
                      t.localization.hiddenBeforeDefault,
                      submenuHiddenBlocks.length,
                      uiLocale,
                      { language: languageName(row.locale) },
                    )
              }}
            </span>
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          :data-testid="`language-remove-${row.locale}`"
          :class="rowClass"
          class="tpl:text-[var(--tpl-danger)]"
          @click="startRemove(row.locale)"
        >
          <Trash2 :size="14" aria-hidden="true" />{{
            format(t.localization.removeLanguage, {
              language: languageName(row.locale),
            })
          }}…
        </button>
      </div>
      <div
        v-if="available.length && editable"
        class="tpl:relative tpl:border-t tpl:border-[var(--tpl-border)]"
      >
        <button
          type="button"
          role="menuitem"
          data-testid="language-add"
          aria-haspopup="menu"
          :aria-expanded="submenu === 'add'"
          :class="rowClass"
          @click="openSubmenu('add')"
        >
          <Plus :size="14" aria-hidden="true" />{{ t.localization.addLanguage
          }}<ChevronRight :size="12" aria-hidden="true" class="tpl:ml-auto" />
        </button>
        <div
          v-if="submenu === 'add'"
          role="menu"
          data-language-submenu
          :aria-label="t.localization.addLanguage"
          :class="surfaceClass"
          class="tpl-language-submenu tpl:absolute tpl:left-full tpl:bottom-0 tpl:ml-1 tpl:max-h-64 tpl:w-48 tpl:overflow-y-auto"
        >
          <button
            v-for="locale in available"
            :key="locale"
            type="button"
            role="menuitem"
            :data-testid="`language-add-${locale}`"
            :class="rowClass"
            @click="add(locale)"
          >
            {{ languageName(locale) }}
          </button>
        </div>
      </div>
    </div>
    <TplModal
      :visible="removing !== null || promoting !== null"
      @close="closeConfirmation"
    >
      <section
        role="dialog"
        aria-modal="true"
        :aria-label="confirmationTitle"
        class="tpl:w-80 tpl:max-w-full tpl:max-h-[90%] tpl:overflow-y-auto tpl:box-border tpl:rounded-[var(--tpl-radius)] tpl:bg-[var(--tpl-bg)] tpl:p-5 tpl:shadow-[var(--tpl-shadow-lg)]"
      >
        <h3
          class="tpl:m-0 tpl:mb-4 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{ confirmationTitle }}
        </h3>
        <p
          v-if="promoting && promotionCount"
          class="tpl:mb-4 tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
        >
          {{
            plural(t.localization.defaultGaps, promotionCount, uiLocale, {
              language: languageName(promoting.locale),
              default: languageName(source),
            })
          }}
        </p>
        <p
          v-if="removing"
          class="tpl:mb-4 tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
        >
          {{
            format(t.localization.removeDescription, {
              language: languageName(removing),
            })
          }}
        </p>
        <p
          v-if="promotionError"
          role="alert"
          data-testid="language-default-error"
          class="tpl:mb-4 tpl:flex tpl:items-start tpl:gap-2 tpl:text-sm tpl:text-[var(--tpl-danger)]"
        >
          <AlertTriangle :size="14" aria-hidden="true" class="tpl:shrink-0" />
          <span>{{ promotionError }}</span>
        </p>
        <div class="tpl:flex tpl:justify-end tpl:gap-2">
          <button
            type="button"
            :data-testid="
              promoting ? 'language-default-cancel' : 'language-remove-cancel'
            "
            :class="secondaryBtnClass"
            @click="closeConfirmation"
          >
            {{ t.localization.cancel }}
          </button>
          <button
            type="button"
            :data-testid="
              promoting ? 'language-default-confirm' : 'language-remove-confirm'
            "
            :class="removing ? dangerBtnClass : primaryBtnClass"
            :disabled="!editable"
            @click="confirm"
          >
            {{
              promoting
                ? t.localization.makeDefault
                : format(t.localization.removeLanguage, {
                    language: languageName(removing ?? source),
                  })
            }}
          </button>
        </div>
      </section>
    </TplModal>
  </div>
</template>

<style scoped>
@container tpl-header (max-width: 760px) {
  .tpl-language-submenu {
    left: 0;
    top: 100%;
    bottom: auto;
    margin: 4px 0 0;
    max-width: 100%;
  }
}

.tpl-language-row:hover,
.tpl-language-row:focus-within,
[role="menuitem"]:hover {
  background: var(--tpl-bg-hover);
}
.tpl-language-row[data-active="true"] {
  background: var(--tpl-bg-active);
}
/* The pill's usual fill is the active row's tint; paper keeps it visible. */
.tpl-language-row[data-active="true"] .tpl-language-pill {
  background: var(--tpl-bg);
}
/* The menu renders in the header, never inside block content, so the raw
   tokens are the right ones here. */
[aria-disabled="true"] {
  cursor: not-allowed;
  color: var(--tpl-text-muted);
}
[aria-disabled="true"] svg {
  color: var(--tpl-text-dim);
}
@media (hover: hover) and (pointer: fine) {
  .tpl-language-actions {
    opacity: 0;
  }
  .tpl-language-row:hover .tpl-language-actions,
  .tpl-language-row:focus-within .tpl-language-actions,
  .tpl-language-actions[aria-expanded="true"] {
    opacity: 1;
  }
}
.tpl-language-actions {
  transition: opacity var(--tpl-transition);
}
</style>
