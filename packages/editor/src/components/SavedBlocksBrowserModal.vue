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
const selectedId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);
const renamingId = ref<string | null>(null);
const renameDraft = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
// 'end' = append, 'beginning' = index 0, or block id = after that block
const insertPosition = ref<string>("end");

// Order is the provider's to decide — the editor never re-sorts. Whatever
// `list()` returns is what the user sees (the bundled localStorage adapter, for
// instance, returns newest-first). Search only filters; it never reorders.
const filtered = computed(() => {
  const all = savedBlocks.savedBlocks.value;
  if (!searchQuery.value) return all;
  const query = searchQuery.value.toLowerCase();
  return all.filter((b) => b.name.toLowerCase().includes(query));
});

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
  const raw = saved.updated_at ?? saved.created_at;
  if (!raw) return "";
  return formatRelativeTime(raw, t.savedBlocks.time, format) ?? "";
}

/** Absolute timestamp for the row's tooltip — locale-formatted, no i18n keys. */
function absoluteLabel(saved: SavedBlock): string {
  const raw = saved.updated_at ?? saved.created_at;
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
  renamingId.value = saved.id;
  renameDraft.value = saved.name;
  confirmDeleteId.value = null;
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
}

function cancelRename(): void {
  renamingId.value = null;
  renameDraft.value = "";
}

async function commitRename(id: string): Promise<void> {
  // Guards two races: Escape sets `renamingId` to null and the unmounting
  // input can still emit `blur`, and Enter commits then blurs. Either would
  // otherwise fire a second, unwanted update.
  if (renamingId.value !== id) return;
  const next = renameDraft.value.trim();
  const current = savedBlocks.savedBlocks.value.find((b) => b.id === id);
  // Skip the round-trip when the name is empty or unchanged.
  if (!next || next === current?.name) {
    cancelRename();
    return;
  }
  try {
    await savedBlocks.update(id, { name: next });
  } finally {
    cancelRename();
  }
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
    <div
      role="dialog"
      aria-modal="true"
      data-testid="saved-blocks-browser"
      aria-labelledby="tpl-saved-blocks-browser-title"
      class="tpl-scale-in tpl:mx-4 tpl:flex tpl:w-full tpl:max-w-[1000px] tpl:flex-col tpl:rounded-[var(--tpl-radius-lg)]"
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
          <!-- Search -->
          <div class="tpl:px-4 tpl:pt-4 tpl:pb-3">
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
                class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:pl-9 tpl:pr-3 tpl:text-sm tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
              />
            </div>
          </div>

          <!-- List -->
          <div class="tpl:flex-1 tpl:overflow-y-auto tpl:px-4 tpl:pb-4">
            <div
              v-if="filtered.length > 0"
              class="tpl:flex tpl:flex-col tpl:gap-1"
            >
              <template v-for="item in filtered" :key="item.id">
                <!-- Inline rename replaces the whole row: an <input> nested
                     inside the card <button> would be invalid markup and
                     wouldn't focus reliably. -->
                <div
                  v-if="renamingId === item.id"
                  class="tpl:w-full tpl:rounded-[var(--tpl-radius-md)] tpl:border tpl:px-3 tpl:py-2 tpl:border-[var(--tpl-primary)]"
                  style="background-color: var(--tpl-primary-light)"
                >
                  <input
                    :ref="(el) => (renameInput = el as HTMLInputElement | null)"
                    v-model="renameDraft"
                    type="text"
                    :aria-label="t.savedBlocks.rename"
                    class="tpl:h-7 tpl:w-full tpl:rounded-md tpl:border tpl:px-2 tpl:text-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
                    @keydown.enter.prevent.stop="commitRename(item.id)"
                    @keydown.esc.prevent.stop="cancelRename()"
                    @blur="commitRename(item.id)"
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
                    <template v-else>
                      <button
                        class="tpl-saved-block-rename-btn tpl:ml-auto tpl:cursor-pointer tpl:rounded-md tpl:border-none tpl:bg-transparent tpl:p-0.5 tpl:transition-colors tpl:duration-100 tpl:text-[var(--tpl-text-dim)]"
                        :aria-label="t.savedBlocks.rename"
                        :title="t.savedBlocks.rename"
                        @click.stop="startRename(item)"
                      >
                        <Pencil :size="12" :stroke-width="1.5" />
                      </button>
                      <button
                        class="tpl-saved-block-delete-btn tpl:cursor-pointer tpl:rounded-md tpl:border-none tpl:bg-transparent tpl:p-0.5 tpl:transition-colors tpl:duration-100 tpl:text-[var(--tpl-text-dim)]"
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

            <!-- Empty state -->
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
                v-if="searchQuery"
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
.tpl-saved-block-delete-btn:hover {
  color: var(--tpl-danger) !important;
}

.tpl-saved-block-rename-btn:hover {
  color: var(--tpl-primary) !important;
}
</style>
