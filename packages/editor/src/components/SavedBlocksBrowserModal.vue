<script setup lang="ts">
import TplModal from "./TplModal.vue";
import { useI18n } from "../composables";
import { blockTypeIcons } from "../utils/blockTypeIcons";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { SAVED_BLOCKS_KEY, EDITOR_KEY, requireInject } from "../keys";
import type { SavedBlock } from "@templatical/types";
import { Package, Pencil, Search, Trash2, X } from "@lucide/vue";
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "insert", saved: SavedBlock, insertIndex: number | undefined): void;
}>();

const SavedBlockPreviewCanvas = defineAsyncComponent(
  () => import("./SavedBlockPreviewCanvas.vue"),
);

const { t, format } = useI18n();
const savedBlocks = requireInject(SAVED_BLOCKS_KEY, "SavedBlocksBrowserModal");
const editor = requireInject(EDITOR_KEY, "SavedBlocksBrowserModal");

const searchQuery = ref("");
/** `""` = no category filter. Matched exactly against `SavedBlock.category`. */
const categoryFilter = ref("");
const selectedId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);
const renamingId = ref<string | null>(null);
const renameDraft = ref("");
const renameCategoryDraft = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
// 'end' = append, 'beginning' = index 0, or block id = after that block
const insertPosition = ref<string>("end");

// Order is the provider's to decide — the editor never re-sorts. Whatever
// `list()` returns is what the user sees (the bundled localStorage adapter, for
// instance, returns newest-first). Filters only narrow; they never reorder.
//
// Both filters run in memory over the loaded entries rather than round-tripping
// to the provider: that keeps a BYO provider at four dumb methods, and it is
// what lets the category options below be derived at all — a provider-filtered
// response could not tell us which other categories exist.
const filtered = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const category = categoryFilter.value;
  return savedBlocks.savedBlocks.value.filter((b) => {
    if (query && !b.name.toLowerCase().includes(query)) return false;
    if (category && b.category !== category) return false;
    return true;
  });
});

/**
 * The list is fetched when this modal opens, not at editor mount, so a first
 * open can arrive before the provider answers. Show the skeleton only while
 * there is *nothing* to display: on a reopen the previous entries render
 * immediately and the refetch lands underneath them.
 *
 * Without this the empty state would claim "No saved blocks yet" for the whole
 * duration of the request — false, not merely unhelpful.
 */
const isInitialLoad = computed(
  () =>
    savedBlocks.isLoading.value && savedBlocks.savedBlocks.value.length === 0,
);

/** Whether any filter is narrowing the list — drives the empty-state copy. */
const isFiltering = computed(
  () => searchQuery.value.trim().length > 0 || categoryFilter.value !== "",
);

const selected = computed(() => {
  if (!selectedId.value) return null;
  return (
    savedBlocks.savedBlocks.value.find((b) => b.id === selectedId.value) ?? null
  );
});

interface PositionOption {
  value: string;
  label: string;
}

const positionOptions = computed<PositionOption[]>(() => {
  const options: PositionOption[] = [
    { value: "beginning", label: t.savedBlocks.insertAtBeginning },
  ];
  const blocks = editor.content.value.blocks;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const typeKey = block.type as keyof typeof t.blocks;
    const label = t.blocks[typeKey] ?? block.type;
    options.push({
      value: block.id,
      label: format(t.savedBlocks.insertAfterBlock, {
        block: `${label} ${i + 1}`,
      }),
    });
  }
  options.push({ value: "end", label: t.savedBlocks.insertAtEnd });
  return options;
});

const resolvedInsertIndex = computed<number | undefined>(() => {
  if (insertPosition.value === "end") return undefined;
  if (insertPosition.value === "beginning") return 0;
  const blocks = editor.content.value.blocks;
  const idx = blocks.findIndex((b) => b.id === insertPosition.value);
  if (idx !== -1) return idx + 1;
  return undefined;
});

// `immediate` matters: the modal is mounted lazily behind a `v-if` on the same
// state that drives `visible`, so it can mount with `visible` already true and
// would otherwise never resolve the default insert position.
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      searchQuery.value = "";
      categoryFilter.value = "";
      selectedId.value = null;
      confirmDeleteId.value = null;
      renamingId.value = null;
      // Default to after selected block, or end
      const selectedBlockId = editor.state.selectedBlockId;
      if (selectedBlockId) {
        const idx = editor.content.value.blocks.findIndex(
          (b) => b.id === selectedBlockId,
        );
        insertPosition.value = idx !== -1 ? selectedBlockId : "end";
      } else {
        insertPosition.value = "end";
      }
    }
  },
  { immediate: true },
);

function getBlockTypeIcons(
  saved: SavedBlock,
): { type: string; icon: unknown }[] {
  const icons: { type: string; icon: unknown }[] = [];
  const seen = new Set<string>();
  for (const block of saved.content) {
    if (!seen.has(block.type) && blockTypeIcons[block.type]) {
      seen.add(block.type);
      icons.push({ type: block.type, icon: blockTypeIcons[block.type] });
    }
    if (icons.length >= 5) break;
  }
  return icons;
}

function getRemainingTypeCount(saved: SavedBlock): number {
  const types = new Set(saved.content.map((b) => b.type));
  return Math.max(0, types.size - 5);
}

/** Compact "5m ago" label, or "" when the provider supplies no usable timestamp. */
function relativeLabel(saved: SavedBlock): string {
  const raw = saved.updatedAt ?? saved.createdAt;
  if (!raw) return "";
  return formatRelativeTime(raw, t.savedBlocks.time, format) ?? "";
}

/** Absolute timestamp for the row's tooltip — locale-formatted, no i18n keys. */
function absoluteLabel(saved: SavedBlock): string {
  const raw = saved.updatedAt ?? saved.createdAt;
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
}

async function handleDelete(id: string): Promise<void> {
  try {
    await savedBlocks.remove(id);
    if (selectedId.value === id) {
      selectedId.value = null;
    }
  } finally {
    confirmDeleteId.value = null;
  }
}

async function startRename(saved: SavedBlock): Promise<void> {
  // The pencil is already hidden when editing isn't permitted; this stops a
  // programmatic call opening an editor whose commit could only fail.
  if (!savedBlocks.canUpdateBlock(saved)) return;
  renamingId.value = saved.id;
  renameDraft.value = saved.name;
  renameCategoryDraft.value = saved.category ?? "";
  confirmDeleteId.value = null;
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
}

function cancelRename(): void {
  renamingId.value = null;
  renameDraft.value = "";
  renameCategoryDraft.value = "";
}

async function commitRename(id: string): Promise<void> {
  // Guards two races: Escape sets `renamingId` to null and the unmounting
  // input can still emit `blur`, and Enter commits then blurs. Either would
  // otherwise fire a second, unwanted update.
  if (renamingId.value !== id) return;
  const nextName = renameDraft.value.trim();
  const nextCategory = renameCategoryDraft.value.trim();
  const current = savedBlocks.savedBlocks.value.find((b) => b.id === id);

  // An empty name is not a rename — fall back to what's stored, so clearing
  // the field and blurring can't wipe the entry's name.
  const patch: Partial<{ name: string; category: string }> = {};
  if (nextName && nextName !== current?.name) patch.name = nextName;
  // "" is meaningful here: it clears the category. Only skip when unchanged.
  if (nextCategory !== (current?.category ?? "")) patch.category = nextCategory;

  // Skip the round-trip when nothing actually changed.
  if (Object.keys(patch).length === 0) {
    cancelRename();
    return;
  }
  try {
    await savedBlocks.update(id, patch);
  } finally {
    cancelRename();
  }
}

/**
 * Commit when focus leaves the edit row entirely — not when it moves between
 * the name and category inputs. A plain `@blur` on each input would commit
 * (and unmount the row) the moment the user tabbed from one to the other.
 */
function onEditFocusOut(event: FocusEvent, id: string): void {
  const row = event.currentTarget as HTMLElement;
  const next = event.relatedTarget as Node | null;
  if (next && row.contains(next)) return;
  void commitRename(id);
}

function handleInsert(): void {
  if (selected.value) {
    emit("insert", selected.value, resolvedInsertIndex.value);
  }
}

function handleClose(): void {
  emit("close");
}

function handleKeydown(event: KeyboardEvent): void {
  // While renaming, Enter/Escape belong to the inline input, not the dialog.
  if (renamingId.value) return;
  if (event.key === "Escape") {
    handleClose();
  }
  if (event.key === "Enter" && selected.value) {
    event.preventDefault();
    handleInsert();
  }
}
</script>

<template>
  <TplModal :visible="visible" @close="handleClose" @keydown="handleKeydown">
    <!-- Explicit width, not `w-full`: the modal's parent is shrink-to-fit, so
         `width: 100%` resolved against its own contents and the 600px preview
         canvas drove the dialog's size — it measured 523px with nothing selected
         and 965px with a block selected, nearly doubling on click. A pinned
         width makes every state identical and stops any future right-pane
         content from moving it. `max-w` keeps it inside narrow viewports, expressed
         against `--tpl-base-size` rather than `rem` so the editor stays immune to
         the host page's root font-size (issue #209); the preview scrolls within. -->
    <div
      role="dialog"
      aria-modal="true"
      data-testid="saved-blocks-browser"
      aria-labelledby="tpl-saved-blocks-browser-title"
      class="tpl-scale-in tpl:mx-4 tpl:flex tpl:w-[1000px] tpl:max-w-[calc(100vw_-_2*var(--tpl-base-size))] tpl:flex-col tpl:rounded-[var(--tpl-radius-lg)]"
      style="
        background-color: var(--tpl-bg-elevated);
        box-shadow: var(--tpl-shadow-xl);
        max-height: 90vh;
      "
    >
      <!-- Header -->
      <div
        class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:px-5 tpl:py-4 tpl:border-[var(--tpl-border)]"
      >
        <h3
          id="tpl-saved-blocks-browser-title"
          class="tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          {{ t.savedBlocks.browse }}
        </h3>
        <button
          :aria-label="t.savedBlocks.close"
          class="tpl:cursor-pointer tpl:rounded-md tpl:border-none tpl:bg-transparent tpl:p-1 tpl:transition-colors tpl:duration-100 tpl:text-[var(--tpl-text-dim)]"
          @click="handleClose"
        >
          <X :size="16" :stroke-width="2" />
        </button>
      </div>

      <!-- Body -->
      <div class="tpl:flex tpl:min-h-0 tpl:flex-1 tpl:overflow-hidden">
        <!-- Left panel: saved block list -->
        <div
          class="tpl:flex tpl:w-[300px] tpl:shrink-0 tpl:flex-col tpl:overflow-hidden"
        >
          <!-- Search + category filter -->
          <div
            class="tpl:flex tpl:flex-col tpl:gap-2 tpl:px-4 tpl:pt-4 tpl:pb-3"
          >
            <div class="tpl:relative">
              <Search
                :size="14"
                :stroke-width="2"
                class="tpl:pointer-events-none tpl:absolute tpl:left-3 tpl:top-1/2 tpl:-translate-y-1/2 tpl:text-[var(--tpl-text-dim)]"
              />
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="t.savedBlocks.search"
                :disabled="isInitialLoad"
                class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:pl-9 tpl:pr-3 tpl:text-sm tpl:outline-none tpl:disabled:opacity-50 tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
              />
            </div>
            <!-- Only worth showing once something is actually categorised. -->
            <select
              v-if="savedBlocks.categories.value.length > 0"
              v-model="categoryFilter"
              data-testid="saved-blocks-category-filter"
              :aria-label="t.savedBlocks.filterByCategory"
              class="tpl:h-8 tpl:w-full tpl:rounded-md tpl:border tpl:px-2 tpl:text-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
            >
              <option value="">{{ t.savedBlocks.allCategories }}</option>
              <option
                v-for="option in savedBlocks.categories.value"
                :key="option"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
          </div>

          <!-- Suggestions for the inline category editor, shared by every row -->
          <datalist id="tpl-saved-block-browser-categories">
            <option
              v-for="option in savedBlocks.categories.value"
              :key="option"
              :value="option"
            />
          </datalist>

          <!-- List -->
          <div class="tpl:flex-1 tpl:overflow-y-auto tpl:px-4 tpl:pb-4">
            <!-- Skeleton rows: same height and gap as a real card, so the pane
                 doesn't resize when the entries land. `aria-busy` on the region
                 is what a screen reader announces; the bars are decorative. -->
            <div
              v-if="isInitialLoad"
              data-testid="saved-blocks-loading"
              class="tpl:flex tpl:flex-col tpl:gap-1"
              role="status"
              aria-busy="true"
              :aria-label="t.savedBlocks.loading"
            >
              <div
                v-for="n in 3"
                :key="n"
                aria-hidden="true"
                class="tpl-saved-block-skeleton tpl:rounded-[var(--tpl-radius-md)] tpl:border tpl:px-3 tpl:py-2 tpl:border-[var(--tpl-border)]"
              >
                <div
                  class="tpl:h-3 tpl:w-1/2 tpl:rounded tpl:bg-[var(--tpl-bg-hover)]"
                />
                <div
                  class="tpl:mt-2 tpl:h-2.5 tpl:w-1/4 tpl:rounded tpl:bg-[var(--tpl-bg-hover)]"
                />
              </div>
            </div>

            <div
              v-else-if="filtered.length > 0"
              class="tpl:flex tpl:flex-col tpl:gap-1"
            >
              <template v-for="item in filtered" :key="item.id">
                <!-- Inline rename replaces the whole row: an <input> nested
                     inside the card <button> would be invalid markup and
                     wouldn't focus reliably. -->
                <div
                  v-if="renamingId === item.id"
                  class="tpl:flex tpl:w-full tpl:flex-col tpl:gap-1 tpl:rounded-[var(--tpl-radius-md)] tpl:border tpl:px-3 tpl:py-2 tpl:border-[var(--tpl-primary)]"
                  style="background-color: var(--tpl-primary-light)"
                  @focusout="onEditFocusOut($event, item.id)"
                >
                  <input
                    :ref="(el) => (renameInput = el as HTMLInputElement | null)"
                    v-model="renameDraft"
                    type="text"
                    :aria-label="t.savedBlocks.rename"
                    class="tpl:h-7 tpl:w-full tpl:rounded-md tpl:border tpl:px-2 tpl:text-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
                    @keydown.enter.prevent.stop="commitRename(item.id)"
                    @keydown.esc.prevent.stop="cancelRename()"
                  />
                  <input
                    v-model="renameCategoryDraft"
                    type="text"
                    data-testid="saved-blocks-edit-category"
                    :aria-label="t.savedBlocks.category"
                    :placeholder="t.savedBlocks.categoryPlaceholder"
                    list="tpl-saved-block-browser-categories"
                    class="tpl:h-7 tpl:w-full tpl:rounded-md tpl:border tpl:px-2 tpl:text-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
                    @keydown.enter.prevent.stop="commitRename(item.id)"
                    @keydown.esc.prevent.stop="cancelRename()"
                  />
                </div>

                <button
                  v-else
                  type="button"
                  data-testid="saved-block-card"
                  :aria-pressed="selectedId === item.id"
                  class="tpl:group/card tpl:w-full tpl:cursor-pointer tpl:rounded-[var(--tpl-radius-md)] tpl:border tpl:bg-transparent tpl:px-3 tpl:py-2 tpl:text-left tpl:transition-all tpl:duration-[120ms]"
                  :style="{
                    borderColor:
                      selectedId === item.id
                        ? 'var(--tpl-primary)'
                        : 'var(--tpl-border)',
                    backgroundColor:
                      selectedId === item.id
                        ? 'var(--tpl-primary-light)'
                        : 'transparent',
                  }"
                  @click="selectedId = item.id"
                >
                  <div class="tpl:flex tpl:items-center tpl:gap-2">
                    <span
                      class="tpl:flex-1 tpl:truncate tpl:text-xs tpl:font-semibold tpl:text-[var(--tpl-text)]"
                    >
                      {{ item.name }}
                    </span>
                    <span
                      class="tpl:shrink-0 tpl:rounded-full tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:bg-[var(--tpl-bg-hover)] tpl:text-[var(--tpl-text-muted)]"
                    >
                      {{
                        format(t.savedBlocks.blockCount, {
                          count: item.content.length,
                        })
                      }}
                    </span>
                  </div>
                  <div
                    v-if="item.category"
                    class="tpl:mt-1 tpl:flex tpl:items-center"
                  >
                    <span
                      data-testid="saved-block-category"
                      class="tpl:max-w-full tpl:truncate tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary)]"
                    >
                      {{ item.category }}
                    </span>
                  </div>
                  <div class="tpl:mt-1 tpl:flex tpl:items-center tpl:gap-1">
                    <component
                      :is="icon.icon"
                      v-for="icon in getBlockTypeIcons(item)"
                      :key="icon.type"
                      :size="14"
                      :stroke-width="1.5"
                      class="tpl:text-[var(--tpl-text-dim)]"
                    />
                    <span
                      v-if="getRemainingTypeCount(item) > 0"
                      class="tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
                    >
                      +{{ getRemainingTypeCount(item) }}
                    </span>
                    <span
                      v-if="relativeLabel(item)"
                      data-testid="saved-block-updated"
                      class="tpl:ml-1 tpl:truncate tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
                      :title="absoluteLabel(item)"
                    >
                      {{ relativeLabel(item) }}
                    </span>
                    <button
                      v-if="confirmDeleteId === item.id"
                      :aria-label="t.savedBlocks.deleteConfirm"
                      class="tpl:ml-auto tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-2 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:transition-colors tpl:duration-100 tpl:border-[var(--tpl-danger)] tpl:text-[var(--tpl-danger)]"
                      style="background-color: transparent"
                      @click.stop="handleDelete(item.id)"
                    >
                      {{ t.savedBlocks.deleteConfirm }}
                    </button>
                    <!-- Hidden, not disabled: an action the user can't perform
                         is better absent than greyed out. `ml-auto` moves to
                         whichever button survives so the row stays aligned. -->
                    <template v-else>
                      <button
                        v-if="savedBlocks.canUpdateBlock(item)"
                        class="tpl-saved-block-rename-btn tpl:ml-auto tpl:cursor-pointer tpl:rounded-md tpl:border-none tpl:bg-transparent tpl:p-0.5 tpl:transition-colors tpl:duration-100 tpl:text-[var(--tpl-text-dim)]"
                        :aria-label="t.savedBlocks.rename"
                        :title="t.savedBlocks.rename"
                        @click.stop="startRename(item)"
                      >
                        <Pencil :size="12" :stroke-width="1.5" />
                      </button>
                      <button
                        v-if="savedBlocks.canDeleteBlock(item)"
                        class="tpl-saved-block-delete-btn tpl:cursor-pointer tpl:rounded-md tpl:border-none tpl:bg-transparent tpl:p-0.5 tpl:transition-colors tpl:duration-100 tpl:text-[var(--tpl-text-dim)]"
                        :class="{
                          'tpl:ml-auto': !savedBlocks.canUpdateBlock(item),
                        }"
                        :aria-label="t.savedBlocks.delete"
                        :title="t.savedBlocks.delete"
                        @click.stop="confirmDeleteId = item.id"
                      >
                        <Trash2 :size="12" :stroke-width="1.5" />
                      </button>
                    </template>
                  </div>
                </button>
              </template>
            </div>

            <!-- Empty state — only once we actually know the library is empty -->
            <div
              v-else
              class="tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:py-12"
            >
              <Package
                :size="32"
                :stroke-width="1"
                class="tpl:text-[var(--tpl-text-dim)]"
              />
              <p
                v-if="isFiltering"
                class="tpl:mt-2 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
              >
                {{ t.savedBlocks.noResults }}
              </p>
              <template v-else>
                <p class="tpl:mt-2 tpl:text-xs tpl:text-[var(--tpl-text-dim)]">
                  {{ t.savedBlocks.empty }}
                </p>
                <p
                  class="tpl:mt-1 tpl:max-w-[220px] tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
                >
                  {{ t.savedBlocks.emptyHint }}
                </p>
              </template>
            </div>
          </div>
        </div>

        <!-- Right panel: preview -->
        <div
          class="tpl:flex tpl:flex-1 tpl:flex-col tpl:overflow-hidden tpl:border-l tpl:border-[var(--tpl-border)]"
        >
          <div
            v-if="selected"
            class="tpl:flex tpl:flex-1 tpl:flex-col tpl:overflow-hidden"
          >
            <!-- Visual preview -->
            <div class="tpl:flex-1 tpl:overflow-y-auto tpl:p-4">
              <SavedBlockPreviewCanvas :blocks="selected.content" />
            </div>
          </div>

          <!-- Empty preview state -->
          <div
            v-else
            class="tpl:flex tpl:flex-1 tpl:flex-col tpl:items-center tpl:justify-center tpl:px-4"
          >
            <Package
              :size="32"
              :stroke-width="1"
              class="tpl:text-[var(--tpl-text-dim)]"
            />
            <p
              class="tpl:mt-2 tpl:text-center tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
            >
              {{ t.savedBlocks.selectToPreview }}
            </p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="tpl:flex tpl:items-center tpl:justify-between tpl:border-t tpl:px-5 tpl:py-3 tpl:border-[var(--tpl-border)]"
      >
        <div class="tpl:flex tpl:items-center tpl:gap-2">
          <label
            class="tpl:shrink-0 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
          >
            {{ t.savedBlocks.insertPosition }}
          </label>
          <select
            v-model="insertPosition"
            class="tpl:h-7 tpl:max-w-[220px] tpl:rounded-md tpl:border tpl:px-2 tpl:text-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
          >
            <option
              v-for="opt in positionOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="tpl:flex tpl:gap-2">
          <button
            type="button"
            data-testid="saved-blocks-browser-close"
            class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)]"
            @click="handleClose"
          >
            {{ t.savedBlocks.close }}
          </button>
          <button
            type="button"
            class="tpl:cursor-pointer tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50 tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
            :disabled="!selected"
            @click="handleInsert"
          >
            {{ t.savedBlocks.insert }}
          </button>
        </div>
      </div>
    </div>
  </TplModal>
</template>

<style>
/* Subtle breathing so the placeholders read as "loading" rather than as empty
   rows. `prefers-reduced-motion` holds them still at full opacity — the bars
   still communicate shape without animating. */
.tpl-saved-block-skeleton {
  animation: tpl-saved-block-pulse 1.4s ease-in-out infinite;
}

@keyframes tpl-saved-block-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tpl-saved-block-skeleton {
    animation: none;
  }
}

.tpl-saved-block-delete-btn:hover {
  color: var(--tpl-danger) !important;
}

.tpl-saved-block-rename-btn:hover {
  color: var(--tpl-primary) !important;
}
</style>
