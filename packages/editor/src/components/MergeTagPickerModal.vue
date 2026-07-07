<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  ref,
  watch,
  type ComponentPublicInstance,
} from "vue";
import { refDebounced } from "@vueuse/core";
import { ChevronDown, Search, X } from "@lucide/vue";
import type { MergeTag } from "@templatical/types";
import TplModal from "./TplModal.vue";
import { useI18n } from "../composables/useI18n";
import {
  MERGE_TAG_PICKER_KEY,
  THEME_STYLES_KEY,
  UI_THEME_KEY,
  requireInject,
} from "../keys";

// Picker singleton — provided by useEditorCore. We require it explicitly so
// the modal is unmountable only in a non-editor context (which we don't
// support). `requireInject` throws a clear message rather than letting a
// silent inject default mask the misuse.
const picker = requireInject(MERGE_TAG_PICKER_KEY, "MergeTagPickerModal");
const { t, format } = useI18n();

// Theming — same pattern as every other OSS panel (ParagraphToolbar,
// RichTextLinkDialog). The panel carries the `tpl` token class, so it must
// re-establish the theme locally: `data-tpl-theme` selects the dark token
// block, and the inline `themeStyles` apply the consumer's `theme` config
// overrides. Without these the base `.tpl` rule shadows both with light
// defaults and the picker ignores dark mode + custom theme colors.
const themeStyles = inject(THEME_STYLES_KEY, null);
const tplUiTheme = inject(UI_THEME_KEY, null);

// --- Search ---
const rawSearch = ref("");
// 200ms debounce keeps filtering responsive at 1000+ tags. The raw value
// drives the input element (so typing feels instant); the filter reads
// the debounced copy.
const search = refDebounced(rawSearch, 200);
const searchInputRef = ref<HTMLInputElement | null>(null);
const listId = "tpl-merge-tag-picker-list";
const searchActive = computed(() => search.value.trim().length > 0);

// --- Highlight (keyboard nav state) ---
const highlightedIndex = ref(0);

// --- Grouping mode ---
// Active only when at least one tag carries `group`. When inactive, the
// list renders flat with no headers (not even "Other"). The plan locks
// this down in "Decisions locked in" #7.
const hasGroups = computed(() =>
  picker.tags.value.some((tag) => Boolean(tag.group)),
);

// --- Collapsed groups (by label) ---
// Reset on every modal open so each session starts with all groups
// visible. Persistence across opens would surprise users who expanded
// in a previous edit; the cost of re-collapsing is one click.
const collapsedGroups = ref<Set<string>>(new Set());
function isCollapsed(group: string): boolean {
  return collapsedGroups.value.has(group);
}
function toggleGroup(group: string): void {
  const next = new Set(collapsedGroups.value);
  if (next.has(group)) next.delete(group);
  else next.add(group);
  collapsedGroups.value = next;
  // Re-anchor highlight to the first visible tag — index of a
  // previously-highlighted item may now point elsewhere after the
  // collapse rearranges visibleTags.
  highlightedIndex.value = 0;
}

// --- Filtered tags ---
// Case-insensitive substring match against label, value, description.
// Insertion order is preserved (per decision #9).
const filteredTags = computed<MergeTag[]>(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return picker.tags.value;
  return picker.tags.value.filter((tag) => {
    const haystack = [tag.label, tag.value, tag.description ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});

// --- Group order (insertion order of first appearance) ---
// Computed against the *full* tags list (not the filtered one) so the
// pill row stays stable as the user types. The pills represent the
// configured groupings; filter just adjusts which items are shown.
const groupOrder = computed<string[]>(() => {
  if (!hasGroups.value) return [];
  const otherLabel = t.mergeTag.picker.otherGroup;
  const seen = new Set<string>();
  const order: string[] = [];
  for (const tag of picker.tags.value) {
    const key = tag.group ?? otherLabel;
    if (seen.has(key)) continue;
    seen.add(key);
    order.push(key);
  }
  return order;
});

// --- Rendered rows (header + tag entries) ---
// Headers are only emitted in grouped mode AND only when there is no
// active search query (per decisions #6 + #7). Flat-list mode and
// search-active mode both render a header-less sequence.
//
// Collapsed groups still emit their header row (so the header stays
// clickable), but skip their tag rows entirely — those tags are then
// absent from `visibleTags` and the highlight skips over them.
type Row =
  | { kind: "header"; group: string; count: number }
  | { kind: "tag"; tag: MergeTag; index: number };

const rows = computed<Row[]>(() => {
  const tags = filteredTags.value;
  if (!hasGroups.value || searchActive.value) {
    return tags.map((tag, index) => ({ kind: "tag", tag, index }));
  }

  // Grouped mode: bucket by `group`, ungrouped → "Other".
  const otherLabel = t.mergeTag.picker.otherGroup;
  const buckets = new Map<string, MergeTag[]>();
  // Insertion order over the first appearance of each group label.
  const order: string[] = [];
  for (const tag of tags) {
    const key = tag.group ?? otherLabel;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(tag);
  }

  const result: Row[] = [];
  let tagIndex = 0;
  for (const groupKey of order) {
    const items = buckets.get(groupKey)!;
    result.push({ kind: "header", group: groupKey, count: items.length });
    if (collapsedGroups.value.has(groupKey)) continue;
    for (const tag of items) {
      result.push({ kind: "tag", tag, index: tagIndex });
      tagIndex++;
    }
  }
  return result;
});

// Flat list of tag-rows only — used for highlight bookkeeping. Keyboard
// nav skips headers, so the highlight index addresses this list directly.
const visibleTags = computed(() =>
  rows.value.flatMap((row) => (row.kind === "tag" ? [row.tag] : [])),
);

// --- Lifecycle: focus search + reset state when modal opens ---
watch(
  () => picker.isOpen.value,
  (isOpen) => {
    if (isOpen) {
      rawSearch.value = "";
      highlightedIndex.value = 0;
      collapsedGroups.value = new Set();
      // Search input is mounted as part of the same render cycle the
      // modal opens; nextTick guarantees the ref is bound before focus.
      nextTick(() => {
        searchInputRef.value?.focus();
      });
    }
  },
);

// Keep the highlight inside the visible-tags bounds whenever the
// filtered list shrinks (e.g. user typed a more specific query).
watch(visibleTags, (next) => {
  if (highlightedIndex.value >= next.length) {
    highlightedIndex.value = Math.max(0, next.length - 1);
  }
});

// --- Actions ---
function selectTag(tag: MergeTag): void {
  picker.resolve(tag);
}

function cancel(): void {
  picker.resolve(null);
}

function moveHighlight(delta: number): void {
  if (visibleTags.value.length === 0) return;
  const next = highlightedIndex.value + delta;
  // Stop at edges (don't wrap) — feels more predictable in a long list.
  highlightedIndex.value = Math.max(
    0,
    Math.min(visibleTags.value.length - 1, next),
  );
  scrollHighlightIntoView();
}

const listRef = ref<HTMLElement | null>(null);
// One ref per group header so the pill row can `scrollIntoView` precisely.
// Bound by callback-ref in the template; cleared (set to null) when Vue
// unmounts the header during re-render.
const headerRefs = ref<Record<string, HTMLElement | null>>({});
// Vue's callback-ref type widens to Element | ComponentPublicInstance | null
// because the same ref shape works for both DOM elements and components.
// Headers are always native buttons, so coerce to HTMLElement once here.
function setHeaderRef(
  group: string,
  el: Element | ComponentPublicInstance | null,
): void {
  headerRefs.value[group] = (el as HTMLElement | null) ?? null;
}

function scrollHighlightIntoView(): void {
  nextTick(() => {
    const container = listRef.value;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(
      `[data-merge-tag-index="${highlightedIndex.value}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  });
}

function jumpToGroup(group: string): void {
  // Expand the group if it was collapsed — otherwise scrolling reveals
  // only the header, which is confusing for a "jump to" affordance.
  if (collapsedGroups.value.has(group)) {
    const next = new Set(collapsedGroups.value);
    next.delete(group);
    collapsedGroups.value = next;
  }
  nextTick(() => {
    const container = listRef.value;
    if (!container) return;
    // Sum the height of every child rendered BEFORE the target header.
    // Avoids two browser quirks:
    //  - `scrollIntoView({ block: "start" })` short-circuits when the
    //    element is currently sticky-pinned at top.
    //  - `offsetTop` historically misreported on sticky elements in some
    //    Chromium versions; offsetHeight on each in-flow child is stable.
    // Each child is a top-level DOM row (header button or tag button),
    // and there are at most a few dozen, so the linear scan is cheap.
    let targetScrollTop = 0;
    let found = false;
    for (const child of Array.from(container.children) as HTMLElement[]) {
      if (
        child.dataset.testid === "merge-tag-picker-group-header" &&
        child.dataset.groupName === group
      ) {
        found = true;
        break;
      }
      targetScrollTop += child.offsetHeight;
    }
    if (!found) return;
    container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
  });
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveHighlight(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveHighlight(-1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const tag = visibleTags.value[highlightedIndex.value];
    if (tag) selectTag(tag);
  }
  // Esc is forwarded by TplModal via its own keydown→close path.
}

function activeOptionId(): string | undefined {
  if (visibleTags.value.length === 0) return undefined;
  return `${listId}-opt-${highlightedIndex.value}`;
}

function optionId(index: number): string {
  return `${listId}-opt-${index}`;
}

// --- Empty states ---
// Distinguish two cases so the messaging is honest:
//  - the consumer configured zero tags (defensive — button shouldn't even
//    render in that case but a programmatic open() should still degrade)
//  - the active search matched nothing
//
// `filteredTags` (NOT `visibleTags`) is the correct signal for "no
// results" — visibleTags also excludes tags inside collapsed groups, so
// collapsing every group would otherwise falsely trigger the empty
// state and hide the headers the user wants to see.
const isEmptyConfig = computed(() => picker.tags.value.length === 0);
const isNoResults = computed(
  () => !isEmptyConfig.value && filteredTags.value.length === 0,
);

// --- Pill row visibility ---
// Pills jump-link to group headers; they only make sense when there are
// at least 2 groups AND the user isn't currently searching (search
// collapses the grouped view to a flat list, so the pills' targets
// disappear).
const showPillRow = computed(
  () => hasGroups.value && groupOrder.value.length > 1 && !searchActive.value,
);
</script>

<template>
  <TplModal :visible="picker.isOpen.value" @close="cancel" @keydown="onKeydown">
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`${listId}-title`"
      :data-tpl-theme="tplUiTheme"
      data-testid="merge-tag-picker-modal"
      class="tpl tpl:flex tpl:max-h-[80vh] tpl:w-[min(420px,92vw)] tpl:flex-col tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:shadow-[var(--tpl-shadow-lg)]"
      :style="themeStyles"
    >
      <!-- Header -->
      <header
        class="tpl:flex tpl:items-center tpl:justify-between tpl:gap-3 tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-3 tpl:py-2.5"
      >
        <h2
          :id="`${listId}-title`"
          class="tpl:m-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{ t.mergeTag.picker.title }}
        </h2>
        <button
          type="button"
          class="tpl:flex tpl:h-7 tpl:w-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:text-[var(--tpl-text-dim)] tpl:transition-colors tpl:hover:bg-[var(--tpl-bg-hover)] tpl:hover:text-[var(--tpl-text)]"
          :aria-label="t.mergeTag.picker.close"
          data-testid="merge-tag-picker-close"
          @click="cancel"
        >
          <X :size="16" :stroke-width="2" />
        </button>
      </header>

      <!-- Search -->
      <div
        class="tpl:relative tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-3 tpl:py-2.5"
      >
        <Search
          class="tpl:pointer-events-none tpl:absolute tpl:top-1/2 tpl:left-5 tpl:-translate-y-1/2 tpl:text-[var(--tpl-text-dim)]"
          :size="14"
          :stroke-width="2"
        />
        <input
          :id="`${listId}-search`"
          ref="searchInputRef"
          v-model="rawSearch"
          type="text"
          class="tpl:w-full tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:py-1.5 tpl:pr-3 tpl:pl-8 tpl:text-sm tpl:text-[var(--tpl-text)] tpl:outline-none tpl:focus:border-[var(--tpl-primary)]"
          :placeholder="t.mergeTag.picker.searchPlaceholder"
          :aria-label="t.mergeTag.picker.searchAriaLabel"
          :aria-controls="listId"
          :aria-activedescendant="activeOptionId()"
          data-testid="merge-tag-picker-search"
          @keydown.enter.prevent
        />
      </div>

      <!-- Group pills — visible only when grouping is active and the
           user isn't searching. Click a pill to jump (and expand) the
           matching group. Horizontally scrollable so a long group list
           degrades gracefully. -->
      <div
        v-if="showPillRow"
        class="tpl:flex tpl:gap-1.5 tpl:overflow-x-auto tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-3 tpl:py-2"
        data-testid="merge-tag-picker-group-pills"
      >
        <button
          v-for="group in groupOrder"
          :key="group"
          type="button"
          class="tpl:flex tpl:flex-shrink-0 tpl:cursor-pointer tpl:items-center tpl:rounded-full tpl:border tpl:border-[var(--tpl-border)] tpl:bg-transparent tpl:px-2.5 tpl:py-0.5 tpl:text-[11px] tpl:font-medium tpl:text-[var(--tpl-text-dim)] tpl:transition-colors tpl:hover:bg-[var(--tpl-bg-hover)] tpl:hover:text-[var(--tpl-text)]"
          data-testid="merge-tag-picker-group-pill"
          :data-group-name="group"
          @click="jumpToGroup(group)"
        >
          {{ group }}
        </button>
      </div>

      <!-- Body / list -->
      <!-- `position: relative` makes this the offsetParent for the sticky
           group headers below, so `header.offsetTop` reliably reports each
           header's natural in-flow position. jumpToGroup() depends on this
           — see the comment in jumpToGroup() for why scrollIntoView isn't
           sufficient. -->
      <div
        :id="listId"
        ref="listRef"
        class="tpl:relative tpl:max-h-[60vh] tpl:flex-1 tpl:overflow-y-auto"
        role="listbox"
        :aria-label="t.mergeTag.picker.title"
        data-testid="merge-tag-picker-list"
      >
        <template v-if="isEmptyConfig">
          <div
            class="tpl:px-3 tpl:py-6 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
            data-testid="merge-tag-picker-empty"
          >
            {{ t.mergeTag.picker.empty }}
          </div>
        </template>
        <template v-else-if="isNoResults">
          <div
            class="tpl:px-3 tpl:py-6 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
            data-testid="merge-tag-picker-empty"
          >
            {{ t.mergeTag.picker.noResults }}
          </div>
        </template>
        <template v-else>
          <template v-for="(row, rowIndex) in rows" :key="rowIndex">
            <button
              v-if="row.kind === 'header'"
              :ref="(el) => setHeaderRef(row.group, el)"
              type="button"
              :aria-expanded="!isCollapsed(row.group)"
              :aria-controls="listId"
              class="tpl:sticky tpl:top-0 tpl:z-10 tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-[var(--tpl-bg-elevated)] tpl:px-3 tpl:pt-2.5 tpl:pb-1 tpl:text-left tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-dim)] tpl:transition-colors tpl:hover:bg-[var(--tpl-bg-hover)]"
              data-testid="merge-tag-picker-group-header"
              :data-group-name="row.group"
              :data-group-collapsed="isCollapsed(row.group) ? 'true' : 'false'"
              @click="toggleGroup(row.group)"
            >
              <ChevronDown
                :size="12"
                :stroke-width="2"
                class="tpl:transition-transform"
                :class="isCollapsed(row.group) ? 'tpl:-rotate-90' : ''"
              />
              <span>{{ row.group }}</span>
              <span class="tpl:ml-1 tpl:font-normal">
                ({{
                  format(t.mergeTag.picker.groupCount, { count: row.count })
                }})
              </span>
            </button>
            <button
              v-else
              :id="optionId(row.index)"
              type="button"
              role="option"
              :aria-selected="row.index === highlightedIndex"
              :data-selected="row.index === highlightedIndex ? 'true' : 'false'"
              :data-merge-tag-index="row.index"
              :data-merge-tag-value="row.tag.value"
              :title="
                row.tag.description
                  ? `${row.tag.value} — ${row.tag.description}`
                  : row.tag.value
              "
              class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:flex-col tpl:items-start tpl:gap-0.5 tpl:border-none tpl:px-3 tpl:py-1.5 tpl:text-left tpl:transition-colors"
              :class="
                row.index === highlightedIndex
                  ? 'tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary)]'
                  : 'tpl:bg-transparent tpl:text-[var(--tpl-text)] tpl:hover:bg-[var(--tpl-bg-hover)]'
              "
              data-testid="merge-tag-picker-item"
              @mousemove="highlightedIndex = row.index"
              @click="selectTag(row.tag)"
            >
              <span class="tpl:text-sm tpl:font-medium">{{
                row.tag.label
              }}</span>
              <span
                class="tpl:line-clamp-2 tpl:font-mono tpl:text-xs tpl:text-ellipsis tpl:break-all tpl:text-[var(--tpl-text-dim)]"
              >
                {{ row.tag.value }}
              </span>
              <span
                v-if="row.tag.description"
                class="tpl:line-clamp-2 tpl:text-xs tpl:text-ellipsis tpl:text-[var(--tpl-text-dim)]"
              >
                {{ row.tag.description }}
              </span>
            </button>
          </template>
        </template>
      </div>
    </div>
  </TplModal>
</template>
