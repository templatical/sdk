<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import { Search, X } from "@lucide/vue";
import type { LogicPair, LogicTag, SyntaxPreset } from "@templatical/types";
import { SYNTAX_PRESETS } from "@templatical/types";
import TplModal from "./TplModal.vue";
import LogicTagBadge from "./LogicTagBadge.vue";
import { useI18n } from "../composables/useI18n";
import {
  LOGIC_TAG_PICKER_KEY,
  MERGE_TAG_SYNTAX_KEY,
  THEME_STYLES_KEY,
  UI_THEME_KEY,
  requireInject,
} from "../keys";
import type { LogicTagPickerResult } from "../composables/useLogicTagPicker";

// Picker singleton — provided by useEditorCore. Required explicitly so the
// modal only functions inside an editor context.
const picker = requireInject(LOGIC_TAG_PICKER_KEY, "LogicTagPickerModal");
const { t } = useI18n();
const syntax = inject<SyntaxPreset>(
  MERGE_TAG_SYNTAX_KEY,
  SYNTAX_PRESETS.liquid,
);

// Theming — same pattern as MergeTagPickerModal: re-establish the theme
// locally so the `.tpl` token root resolves dark mode + consumer overrides.
const themeStyles = inject(THEME_STYLES_KEY, null);
const tplUiTheme = inject(UI_THEME_KEY, null);

const rawSearch = ref("");
const search = refDebounced(rawSearch, 200);
const searchInputRef = ref<HTMLInputElement | null>(null);
const listId = "tpl-logic-picker-list";
const searchActive = computed(() => search.value.trim().length > 0);

const highlightedIndex = ref(0);

function matches(haystackParts: (string | undefined)[]): boolean {
  const query = search.value.trim().toLowerCase();
  if (!query) return true;
  return haystackParts.filter(Boolean).join(" ").toLowerCase().includes(query);
}

const filteredTags = computed<LogicTag[]>(() =>
  picker.tags.value.filter((tag) =>
    matches([tag.label, tag.value, tag.description]),
  ),
);
const filteredPairs = computed<LogicPair[]>(() =>
  picker.pairs.value.filter((pair) =>
    matches([pair.label, pair.before, pair.after, pair.description]),
  ),
);

// Tags and pairs share one grouped list: a `group` section holds both its
// standalone tags and its open/close pairs, so a group used by both (e.g.
// "Conditions") renders once instead of appearing separately for each kind.
// The badge shape — one pill for a tag, two for a pair — signals
// insert-vs-wrap per row.
type Entry =
  | { kind: "tag"; tag: LogicTag; group?: string }
  | { kind: "pair"; pair: LogicPair; group?: string };

// Pairs first, then standalone tags, so within a shared group the wrapping
// constructs (e.g. If VIP) sort ahead of single tokens (e.g. Else). Group
// order follows first appearance across this combined sequence.
const filteredEntries = computed<Entry[]>(() => [
  ...filteredPairs.value.map((pair): Entry => ({
    kind: "pair",
    pair,
    group: pair.group,
  })),
  ...filteredTags.value.map((tag): Entry => ({
    kind: "tag",
    tag,
    group: tag.group,
  })),
]);

const hasGroups = computed(
  () =>
    picker.tags.value.some((tag) => Boolean(tag.group)) ||
    picker.pairs.value.some((pair) => Boolean(pair.group)),
);

// Rows drive rendering; `items` is the parallel flat list of selectable
// entries in render order, so `highlightedIndex` (keyboard nav) maps 1:1.
type Row =
  | { kind: "header"; label: string }
  | { kind: "tag"; tag: LogicTag; index: number }
  | { kind: "pair"; pair: LogicPair; index: number };

function bucket(entries: Entry[]): [string, Entry[]][] {
  const otherLabel = t.logicTag.picker.otherGroup;
  const map = new Map<string, Entry[]>();
  const order: string[] = [];
  for (const entry of entries) {
    const key = entry.group ?? otherLabel;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(entry);
  }
  return order.map((key) => [key, map.get(key)!]);
}

const built = computed(() => {
  const rows: Row[] = [];
  const items: LogicTagPickerResult[] = [];
  let idx = 0;

  const pushEntry = (entry: Entry): void => {
    if (entry.kind === "tag") {
      rows.push({ kind: "tag", tag: entry.tag, index: idx });
      items.push(entry.tag);
    } else {
      rows.push({ kind: "pair", pair: entry.pair, index: idx });
      items.push(entry.pair);
    }
    idx++;
  };

  const entries = filteredEntries.value;
  if (searchActive.value || !hasGroups.value) {
    // Flat list: search flattens groups (matches the merge-tag picker), and
    // an ungrouped config has no headers to render.
    for (const entry of entries) pushEntry(entry);
  } else {
    for (const [group, groupEntries] of bucket(entries)) {
      rows.push({ kind: "header", label: group });
      for (const entry of groupEntries) pushEntry(entry);
    }
  }

  return { rows, items };
});

const visibleItems = computed(() => built.value.items);

const isEmptyConfig = computed(
  () => picker.tags.value.length === 0 && picker.pairs.value.length === 0,
);
const isNoResults = computed(
  () => !isEmptyConfig.value && visibleItems.value.length === 0,
);

watch(
  () => picker.isOpen.value,
  (isOpen) => {
    if (isOpen) {
      rawSearch.value = "";
      highlightedIndex.value = 0;
      nextTick(() => searchInputRef.value?.focus());
    }
  },
);

watch(visibleItems, (next) => {
  if (highlightedIndex.value >= next.length) {
    highlightedIndex.value = Math.max(0, next.length - 1);
  }
});

const listRef = ref<HTMLElement | null>(null);

function selectItem(item: LogicTagPickerResult): void {
  picker.resolve(item);
}

function cancel(): void {
  picker.resolve(null);
}

function moveHighlight(delta: number): void {
  if (visibleItems.value.length === 0) return;
  highlightedIndex.value = Math.max(
    0,
    Math.min(visibleItems.value.length - 1, highlightedIndex.value + delta),
  );
  nextTick(() => {
    listRef.value
      ?.querySelector<HTMLElement>(
        `[data-logic-index="${highlightedIndex.value}"]`,
      )
      ?.scrollIntoView({ block: "nearest" });
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
    const item = visibleItems.value[highlightedIndex.value];
    if (item) selectItem(item);
  }
}

function optionId(index: number): string {
  return `${listId}-opt-${index}`;
}
function activeOptionId(): string | undefined {
  return visibleItems.value.length === 0
    ? undefined
    : `${listId}-opt-${highlightedIndex.value}`;
}
</script>

<template>
  <TplModal :visible="picker.isOpen.value" @close="cancel" @keydown="onKeydown">
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`${listId}-title`"
      :data-tpl-theme="tplUiTheme"
      data-testid="logic-picker-modal"
      class="tpl tpl:flex tpl:max-h-[80vh] tpl:w-[min(420px,92vw)] tpl:flex-col tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:shadow-[var(--tpl-shadow-lg)]"
      :style="themeStyles"
    >
      <header
        class="tpl:flex tpl:items-center tpl:justify-between tpl:gap-3 tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-3 tpl:py-2.5"
      >
        <h2
          :id="`${listId}-title`"
          class="tpl:m-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{ t.logicTag.picker.title }}
        </h2>
        <button
          type="button"
          class="tpl:flex tpl:h-7 tpl:w-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:bg-transparent tpl:text-[var(--tpl-text-dim)] tpl:transition-colors tpl:hover:bg-[var(--tpl-bg-hover)] tpl:hover:text-[var(--tpl-text)]"
          :aria-label="t.logicTag.picker.close"
          data-testid="logic-picker-close"
          @click="cancel"
        >
          <X :size="16" :stroke-width="2" />
        </button>
      </header>

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
          :placeholder="t.logicTag.picker.searchPlaceholder"
          :aria-label="t.logicTag.picker.searchAriaLabel"
          :aria-controls="listId"
          :aria-activedescendant="activeOptionId()"
          data-testid="logic-picker-search"
          @keydown.enter.prevent
        />
      </div>

      <div
        :id="listId"
        ref="listRef"
        class="tpl:relative tpl:max-h-[60vh] tpl:flex-1 tpl:overflow-y-auto"
        role="listbox"
        :aria-label="t.logicTag.picker.title"
        data-testid="logic-picker-list"
      >
        <div
          v-if="isEmptyConfig"
          class="tpl:px-3 tpl:py-6 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
          data-testid="logic-picker-empty"
        >
          {{ t.logicTag.picker.empty }}
        </div>
        <div
          v-else-if="isNoResults"
          class="tpl:px-3 tpl:py-6 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
          data-testid="logic-picker-empty"
        >
          {{ t.logicTag.picker.noResults }}
        </div>
        <template v-else>
          <template v-for="(row, rowIndex) in built.rows" :key="rowIndex">
            <div
              v-if="row.kind === 'header'"
              class="tpl:px-3 tpl:pt-2.5 tpl:pb-1 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-dim)]"
              data-testid="logic-picker-header"
              :data-group-name="row.label"
            >
              {{ row.label }}
            </div>
            <button
              v-else
              :id="optionId(row.index)"
              type="button"
              role="option"
              :aria-selected="row.index === highlightedIndex"
              :data-selected="row.index === highlightedIndex ? 'true' : 'false'"
              :data-logic-index="row.index"
              :data-logic-kind="row.kind"
              class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:flex-col tpl:items-start tpl:gap-0.5 tpl:border-none tpl:px-3 tpl:py-1.5 tpl:text-left tpl:transition-colors"
              :class="
                row.index === highlightedIndex
                  ? 'tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary)]'
                  : 'tpl:bg-transparent tpl:text-[var(--tpl-text)] tpl:hover:bg-[var(--tpl-bg-hover)]'
              "
              data-testid="logic-picker-item"
              @mousemove="highlightedIndex = row.index"
              @click="selectItem(row.kind === 'tag' ? row.tag : row.pair)"
            >
              <span
                class="tpl:flex tpl:w-full tpl:items-center tpl:justify-between tpl:gap-2"
              >
                <span class="tpl:text-sm tpl:font-medium">{{
                  row.kind === "tag" ? row.tag.label : row.pair.label
                }}</span>
                <span
                  v-if="row.kind === 'tag'"
                  class="tpl:flex tpl:items-center"
                >
                  <LogicTagBadge :value="row.tag.value" :syntax="syntax" />
                </span>
                <span v-else class="tpl:flex tpl:items-center tpl:gap-1">
                  <LogicTagBadge :value="row.pair.before" :syntax="syntax" />
                  <span class="tpl:text-[var(--tpl-text-dim)]">…</span>
                  <LogicTagBadge :value="row.pair.after" :syntax="syntax" />
                </span>
              </span>
              <span
                class="tpl:line-clamp-2 tpl:font-mono tpl:text-xs tpl:text-ellipsis tpl:break-all tpl:text-[var(--tpl-text-dim)]"
              >
                {{
                  row.kind === "tag"
                    ? row.tag.value
                    : `${row.pair.before} … ${row.pair.after}`
                }}
              </span>
              <span
                v-if="
                  (row.kind === 'tag'
                    ? row.tag.description
                    : row.pair.description) as string | undefined
                "
                class="tpl:line-clamp-2 tpl:text-xs tpl:text-ellipsis tpl:text-[var(--tpl-text-dim)]"
              >
                {{
                  row.kind === "tag"
                    ? row.tag.description
                    : row.pair.description
                }}
              </span>
            </button>
          </template>
        </template>
      </div>
    </div>
  </TplModal>
</template>
