<script setup lang="ts">
import { computed, inject, nextTick, onUnmounted, ref, watch } from "vue";
import { Clock, EyeOff, Languages, Pencil, TriangleAlert } from "@lucide/vue";
import { generateId } from "@templatical/types";
import {
  EDITOR_KEY,
  LOCALE_CHIP_OPENERS_KEY,
  TRANSLATION_FEATURE_KEY,
  UI_LOCALE_KEY,
} from "../../keys";
import { useI18n } from "../../composables/useI18n";
import { useEditorRoot } from "../../composables/useEditorRoot";
import { usePopoverRoot } from "../../composables/usePopoverRoot";
import { usePopoverPosition } from "../../composables/usePopoverPosition";
import { languageName } from "../../utils/languageName";
import { plural } from "../../i18n/plural";
import {
  ghostBtnCompactClass,
  secondaryBtnCompactClass,
  primaryBtnCompactClass,
} from "../../constants/styleConstants";

const props = defineProps<{
  blockId: string;
  state:
    | "missing"
    | "stale"
    | "tags-differ"
    | "changed"
    | "hidden"
    | "default-stale";
  count: number;
  stale: string[];
  tagsDiffer?: string[];
  setPaths: string[];
  staleLocales: string[];
  excerpt: string;
  eligibleGaps: boolean;
  translationCount?: number;
  replacesCurrent?: boolean;
  editable: boolean;
}>();
const editor = inject(EDITOR_KEY, null);
const translation = inject(TRANSLATION_FEATURE_KEY, null);
const chipOpeners = inject(LOCALE_CHIP_OPENERS_KEY, null);
const uiLocale = inject(UI_LOCALE_KEY, "en") ?? "en";
const { t, format } = useI18n();
const root = useEditorRoot();
const popoverRoot = usePopoverRoot();
const { toLocal } = usePopoverPosition();
const trigger = ref<HTMLButtonElement | null>(null);
const popover = ref<HTMLElement | null>(null);
const open = ref(false);
const confirming = ref(false);
const retranslate = ref<HTMLButtonElement | null>(null);
const confirmationCancel = ref<HTMLButtonElement | null>(null);
let openAnchor: DOMRect | null = null;
const position = ref({ top: 0, left: 0 });
const limits = ref({ maxHeight: 0, maxWidth: 0 });
// Unique across editors on one page; Vue's useId() restarts per app.
const id = `tpl-locale-popover-${generateId()}`;
const language = computed(() =>
  languageName(editor?.activeLocale?.value ?? ""),
);
const defaultLanguage = computed(() =>
  languageName(editor?.content.value.settings.locale ?? "en"),
);
const label = computed(() => {
  switch (props.state) {
    case "tags-differ":
      return t.localization.tagsDiffer;
    case "hidden":
      return format(t.localization.hidden, { language: language.value });
    case "changed":
      return format(t.localization.changed, { language: language.value });
    case "default-stale":
      return plural(t.localization.staleLanguages, props.count, uiLocale);
    case "missing":
      return props.count === 1
        ? t.localization.notTranslated
        : plural(t.localization.notTranslatedCount, props.count, uiLocale);
    default:
      return props.count === 1
        ? t.localization.outOfDate
        : plural(t.localization.staleCount, props.count, uiLocale);
  }
});
const icon = computed(() =>
  props.state === "hidden"
    ? EyeOff
    : props.state === "changed"
      ? Pencil
      : props.state === "default-stale"
        ? Languages
        : props.state === "stale"
          ? Clock
          : TriangleAlert,
);
// The badge shows an icon only; where its label is the only place the state
// or a count is said, the popover repeats it for keyboard and touch users.
const labelInPopover = computed(
  () =>
    props.state === "default-stale" ||
    ((props.state === "missing" || props.state === "stale") && props.count > 1),
);
const canTranslate = computed(
  () => props.editable && props.eligibleGaps && translation?.isAvailable.value,
);
function close(focus = false) {
  open.value = false;
  confirming.value = false;
  openAnchor = null;
  if (focus) trigger.value?.focus({ preventScroll: true });
}
async function toggle() {
  if (open.value) return close();
  if (!popoverRoot.value) return;
  open.value = true;
  await positionPopover();
}
async function positionPopover() {
  const target = popoverRoot.value;
  if (!target || !open.value) return;
  const view = target.ownerDocument.defaultView;
  const viewport = view?.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportBottom =
    viewportTop + (viewport?.height ?? view?.innerHeight ?? 0);
  const viewportRight =
    viewportLeft + (viewport?.width ?? view?.innerWidth ?? 0);
  const bounds = target.parentElement?.getBoundingClientRect();
  const top =
    Math.max(viewportTop, bounds?.height ? bounds.top : viewportTop) + 8;
  const left =
    Math.max(viewportLeft, bounds?.width ? bounds.left : viewportLeft) + 8;
  const bottom = Math.max(
    top,
    Math.min(viewportBottom, bounds?.height ? bounds.bottom : viewportBottom) -
      8,
  );
  const right = Math.max(
    left,
    Math.min(viewportRight, bounds?.width ? bounds.right : viewportRight) - 8,
  );
  limits.value = { maxHeight: bottom - top, maxWidth: right - left };
  const anchor = trigger.value!.getBoundingClientRect();
  openAnchor = anchor;
  position.value = toLocal({ top, left });
  await nextTick();
  if (!open.value || !popover.value) return;
  const popup = popover.value.getBoundingClientRect();
  const height = Math.min(popup.height, limits.value.maxHeight);
  const width = Math.min(popup.width, limits.value.maxWidth);
  const below = anchor.bottom + 4;
  const preferredTop =
    below + height <= bottom ? below : anchor.top - height - 4;
  position.value = toLocal({
    top: Math.max(top, Math.min(preferredTop, bottom - height)),
    left: Math.max(left, Math.min(anchor.left, right - width)),
  });
  await nextTick();
  if (open.value)
    (confirming.value ? confirmationCancel.value : popover.value)?.focus({
      preventScroll: true,
    });
}
watch(confirming, async () => {
  if (!open.value) return;
  await positionPopover();
  if (open.value && !confirming.value)
    retranslate.value?.focus({ preventScroll: true });
});
function outside(event: Event) {
  const path = event.composedPath();
  if (!path.includes(trigger.value!) && !path.includes(popover.value!)) close();
}
function onScroll(event: Event) {
  if (event.composedPath().includes(popover.value!)) return;
  const anchor = trigger.value?.getBoundingClientRect();
  // A scroll queued by focusing/revealing the chip may arrive after opening;
  // only a real move of the chip closes the popover.
  if (
    !anchor ||
    !openAnchor ||
    anchor.top !== openAnchor.top ||
    anchor.right !== openAnchor.right
  )
    close();
}
function removeListeners() {
  root.removeEventListener("click", outside, true);
  root.removeEventListener("scroll", onScroll, true);
}
watch(
  open,
  (value) => {
    removeListeners();
    if (value) {
      root.addEventListener("click", outside, true);
      root.addEventListener("scroll", onScroll, true);
    }
  },
  { flush: "sync" },
);
watch(
  [
    () => props.blockId,
    () => props.state,
    () => editor?.activeLocale?.value,
    () => editor?.state.template?.id,
    () => editor?.loadVersion?.value,
  ],
  () => close(),
);
onUnmounted(removeListeners);
const openFromIssue = () => {
  if (!open.value) void toggle();
};
watch(
  () => props.blockId,
  (id, previous) => {
    if (previous && chipOpeners?.get(previous) === openFromIssue)
      chipOpeners.delete(previous);
    chipOpeners?.set(id, openFromIssue);
  },
  { immediate: true },
);
onUnmounted(() => {
  if (chipOpeners?.get(props.blockId) === openFromIssue)
    chipOpeners.delete(props.blockId);
});
function keep() {
  editor?.keepTranslations?.(props.blockId, props.stale);
  close(true);
}
function reset(paths: string[]) {
  editor?.resetLocaleFields?.(props.blockId, paths);
  close(true);
}
function show() {
  editor?.setBlockHidden?.(props.blockId, false);
  close(true);
}
function openLanguage(locale: string) {
  editor?.setActiveLocale?.(locale);
  close();
}
function translate() {
  if (!canTranslate.value || translation?.running.value) return;
  if (props.state === "tags-differ" && props.replacesCurrent) {
    confirming.value = true;
    return;
  }
  void translation?.translate({
    only: props.state === "tags-differ" ? "all" : "gaps",
    blockId: props.blockId,
  });
}
function cancelConfirmation() {
  confirming.value = false;
}
function onEscape() {
  if (confirming.value) cancelConfirmation();
  else close(true);
}
function confirmTranslation() {
  if (
    canTranslate.value &&
    !translation?.running.value &&
    props.translationCount
  ) {
    confirming.value = false;
    void translation?.translate({ only: "all", blockId: props.blockId });
  }
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    data-testid="locale-chip"
    :data-state="state"
    :aria-label="label"
    :title="label"
    :aria-expanded="open"
    :aria-controls="open ? id : undefined"
    aria-haspopup="dialog"
    class="tpl-locale-chip tpl:flex tpl:size-5 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-none tpl:p-0 tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-chrome-text-muted)] tpl:shadow-[var(--tpl-shadow-sm)] tpl:ring-1 tpl:ring-[var(--tpl-border)] tpl:transition-colors tpl:hover:bg-[var(--tpl-bg-hover)] tpl:focus-visible:outline-none tpl:focus-visible:shadow-[var(--tpl-ring)]"
    @click.stop="toggle"
    @keydown.enter.stop.prevent="toggle"
    @keydown.esc.stop.prevent="onEscape"
  >
    <component :is="icon" :size="12" :stroke-width="2" aria-hidden="true" />
  </button>
  <Teleport v-if="popoverRoot && open" :to="popoverRoot">
    <div
      :id="id"
      ref="popover"
      role="dialog"
      :aria-label="confirming ? undefined : label"
      :aria-labelledby="confirming ? `${id}-question` : undefined"
      :aria-describedby="confirming ? `${id}-warning` : undefined"
      tabindex="-1"
      data-testid="locale-popover"
      class="tpl-locale-popover tpl:absolute tpl:z-[10000] tpl:w-[300px] tpl:overflow-y-auto tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-3 tpl:text-sm tpl:text-[var(--tpl-chrome-text)] tpl:shadow-[var(--tpl-shadow-md)] tpl:outline-none"
      :style="{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxHeight: `${limits.maxHeight}px`,
        maxWidth: `${limits.maxWidth}px`,
      }"
      @click.stop
      @keydown.esc.stop.prevent="onEscape"
    >
      <template v-if="confirming">
        <h3
          :id="`${id}-question`"
          class="tpl:m-0 tpl:mb-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{
            plural(
              t.localization.translationConfirmation,
              translationCount ?? 0,
              uiLocale,
            )
          }}
        </h3>
        <p
          :id="`${id}-warning`"
          class="tpl:m-0 tpl:text-[var(--tpl-text-muted)]"
        >
          {{ format(t.localization.translationDescription, { language }) }}
        </p>
        <div class="tpl:mt-2 tpl:flex tpl:flex-wrap tpl:justify-end tpl:gap-2">
          <button
            ref="confirmationCancel"
            type="button"
            data-testid="translation-confirm-cancel"
            :class="secondaryBtnCompactClass"
            @click="cancelConfirmation"
          >
            {{ t.localization.cancel }}
          </button>
          <button
            type="button"
            data-testid="translation-confirm"
            :class="primaryBtnCompactClass"
            :disabled="
              !canTranslate || !!translation?.running.value || !translationCount
            "
            @click="confirmTranslation"
          >
            {{
              plural(
                t.localization.translateAllFields,
                translationCount ?? 0,
                uiLocale,
              )
            }}
          </button>
        </div>
      </template>
      <template v-else>
        <p
          v-if="labelInPopover"
          class="tpl:m-0 tpl:mb-2 tpl:text-xs tpl:font-medium"
        >
          {{ label }}
        </p>
        <p v-if="state === 'missing'" class="tpl:m-0">
          {{
            format(t.localization.missingExplanation, {
              default: defaultLanguage,
            })
          }}
        </p>
        <template v-else-if="state === 'stale'">
          <p class="tpl:m-0">
            {{
              format(t.localization.staleExplanation, {
                default: defaultLanguage,
              })
            }}
          </p>
          <p
            class="tpl:mt-2 tpl:mb-0 tpl:break-words tpl:text-[var(--tpl-chrome-text-muted)]"
          >
            {{ format(t.localization.currentExcerpt, { excerpt }) }}
          </p>
        </template>
        <p v-else-if="state === 'tags-differ'" class="tpl:m-0">
          {{
            format(t.localization.tagsDifferExplanation, {
              default: defaultLanguage,
            })
          }}
        </p>
        <p v-else-if="state === 'changed'" class="tpl:m-0">
          {{
            plural(t.localization.changedProperties, count, uiLocale, {
              default: defaultLanguage,
            })
          }}
        </p>
        <p v-else-if="state === 'hidden'" class="tpl:m-0">
          {{ format(t.localization.hiddenExplanation, { language }) }}
        </p>
        <ul v-else class="tpl:m-0 tpl:list-none tpl:p-0">
          <li
            v-for="tag in staleLocales"
            :key="tag"
            class="tpl:flex tpl:items-center tpl:justify-between tpl:gap-3"
          >
            <span>{{ languageName(tag) }}</span>
            <button
              type="button"
              :class="ghostBtnCompactClass"
              @click="openLanguage(tag)"
            >
              {{ t.localization.open }}
            </button>
          </li>
        </ul>
        <div
          v-if="editable && state !== 'default-stale'"
          class="tpl:mt-2 tpl:flex tpl:flex-wrap tpl:gap-1"
        >
          <button
            v-if="
              canTranslate &&
              (state === 'missing' ||
                state === 'stale' ||
                state === 'tags-differ')
            "
            type="button"
            ref="retranslate"
            :data-testid="
              state === 'missing' ? 'locale-translate' : 'locale-retranslate'
            "
            :class="secondaryBtnCompactClass"
            :disabled="!!translation?.running.value"
            @click="translate"
          >
            {{
              state === "missing"
                ? t.localization.translate
                : t.localization.retranslate
            }}
          </button>
          <template v-if="state === 'stale' || state === 'tags-differ'">
            <button
              type="button"
              v-if="state === 'stale'"
              data-testid="locale-keep"
              :class="
                canTranslate ? ghostBtnCompactClass : secondaryBtnCompactClass
              "
              @click="keep"
            >
              {{ t.localization.keep }}
            </button>
            <button
              type="button"
              data-testid="locale-use-default"
              :class="
                state === 'tags-differ' && !canTranslate
                  ? secondaryBtnCompactClass
                  : ghostBtnCompactClass
              "
              @click="
                reset(state === 'tags-differ' ? (tagsDiffer ?? []) : stale)
              "
            >
              {{
                format(t.localization.useDefaultLanguage, {
                  default: defaultLanguage,
                })
              }}
            </button>
          </template>
          <button
            v-if="state === 'changed'"
            type="button"
            data-testid="locale-reset"
            :class="secondaryBtnCompactClass"
            @click="reset(setPaths)"
          >
            {{ t.localization.resetChanges }}
          </button>
          <button
            v-if="state === 'hidden'"
            type="button"
            data-testid="locale-show"
            :class="secondaryBtnCompactClass"
            @click="show"
          >
            {{ t.localization.show }}
          </button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.tpl-locale-chip[data-state="changed"] {
  color: var(--tpl-secondary);
}
.tpl-locale-chip[data-state="missing"],
.tpl-locale-chip[data-state="stale"],
.tpl-locale-chip[data-state="tags-differ"] {
  color: var(--tpl-warning);
}
</style>
