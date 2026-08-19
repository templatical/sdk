<script setup lang="ts">
import { primaryBtnClass } from "../constants/styleConstants";
import SavedBlockPreviewRow from "./SavedBlockPreviewRow.vue";
import TplModal from "./TplModal.vue";
import { useI18n } from "../composables";
import {
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  EDITOR_KEY,
  SAVED_BLOCKS_KEY,
  requireInject,
} from "../keys";
import { getBlockLabel } from "../utils/blockTypeLabels";
import { LoaderCircle } from "@lucide/vue";
import { VueDraggable } from "vue-draggable-plus";
import type { Block } from "@templatical/types";
import { computed, inject, ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  /**
   * Blocks chosen during the canvas pick session, in the order they were
   * picked — `pickedIds` is built from a `Set`, which iterates in insertion
   * order. That order seeds the reorderable list below. Every id must be a
   * top-level block, which is what the session guarantees.
   */
  pickedIds: readonly string[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved"): void;
}>();

const { t, format } = useI18n();
const editor = requireInject(EDITOR_KEY, "SaveBlockDialog");
const savedBlocks = requireInject(SAVED_BLOCKS_KEY, "SaveBlockDialog");
// Optional: a consumer with no custom blocks never provides definitions, and
// the label helper degrades to the type slug rather than throwing.
const customBlockDefinitions = inject(CUSTOM_BLOCK_DEFINITIONS_KEY, []);

const name = ref("");
const category = ref("");
const isSaving = ref(false);
const error = ref<string | null>(null);
const announcement = ref("");

/**
 * The order the blocks will be saved in: seeded from the pick order, then owned
 * by this dialog once the user drags a row.
 *
 * Ids rather than blocks, deliberately. Resolving late means a block edited
 * while the dialog is open (a collaborator in Cloud) is persisted as it stands
 * at save time, not as it looked when the dialog opened, and an id that stops
 * resolving drops out on its own instead of leaving a stale snapshot behind.
 */
const orderedIds = ref<string[]>([]);

/**
 * The picked blocks in the list's current order. Ids that no longer resolve (a
 * block deleted mid-session) simply drop out.
 */
const pickedBlocks = computed(() => {
  const byId = new Map(editor.content.value.blocks.map((b) => [b.id, b]));
  return orderedIds.value
    .map((id) => byId.get(id))
    .filter((b): b is Block => b !== undefined);
});

/**
 * Sortable's model. The setter reads ids straight back off the emitted entries
 * rather than storing them, so a Sortable `el` expando can never reach the
 * payload `create()` sends to the provider — and because the getter is already
 * filtered, writing through it prunes unresolvable ids too.
 */
const orderedBlocks = computed<Block[]>({
  get: () => pickedBlocks.value,
  set: (blocks) => {
    orderedIds.value = blocks.map((b) => b.id);
  },
});

/** Keyboard reorder from a focused grip: swap with the neighbouring row. */
function moveBlock(blockId: string, delta: -1 | 1): void {
  const order = pickedBlocks.value.map((b) => b.id);
  const from = order.indexOf(blockId);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  orderedIds.value = order;

  const moved = pickedBlocks.value[to];
  announcement.value = moved
    ? format(t.savedBlocks.reorderAnnouncement, {
        block: label(moved),
        position: to + 1,
        total: order.length,
      })
    : "";
}

/** Custom blocks read as the consumer's name for them, not the type `custom`. */
function label(block: Block): string {
  return getBlockLabel(block, t, customBlockDefinitions);
}

/** e.g. "Title, Paragraph, Button" — what the user is about to save. */
const summary = computed(() => pickedBlocks.value.map(label).join(", "));

// `immediate` matters: the dialog is mounted lazily behind a `v-if` on the
// same state that drives `visible`, so it can mount with `visible` already
// true and would otherwise never reset the name field or seed the order.
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      name.value = "";
      category.value = "";
      error.value = null;
      announcement.value = "";
      orderedIds.value = [...props.pickedIds];
    }
  },
  { immediate: true },
);

const canSave = computed(
  () =>
    name.value.trim().length > 0 &&
    pickedBlocks.value.length > 0 &&
    !isSaving.value,
);

async function handleSave(): Promise<void> {
  if (!canSave.value) return;

  const blocks = pickedBlocks.value;
  // Defence in depth: never persist an empty saved block (it would list as
  // "0 block(s)" and insert nothing). Guards a pick set whose ids no longer
  // resolve to anything on the canvas.
  if (blocks.length === 0) return;

  isSaving.value = true;
  error.value = null;

  try {
    // Empty stays undefined rather than "": an entry is either categorised or
    // it isn't, and a blank string would show up as a nameless filter option.
    await savedBlocks.create(
      name.value.trim(),
      blocks,
      category.value.trim() || undefined,
    );
    emit("saved");
    emit("close");
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    isSaving.value = false;
  }
}

function handleClose(): void {
  if (!isSaving.value) {
    emit("close");
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSave();
  }
  if (event.key === "Escape") {
    handleClose();
  }
}
</script>

<template>
  <TplModal :visible="visible" @close="handleClose" @keydown="handleKeydown">
    <div
      role="dialog"
      aria-modal="true"
      :aria-busy="isSaving"
      aria-labelledby="tpl-save-block-title"
      class="tpl-scale-in tpl:mx-4 tpl:flex tpl:w-full tpl:max-w-2xl tpl:flex-col tpl:rounded-[var(--tpl-radius-lg)] tpl:p-5"
      style="
        background-color: var(--tpl-bg-elevated);
        box-shadow: var(--tpl-shadow-xl);
        max-height: 90vh;
      "
    >
      <h3
        id="tpl-save-block-title"
        class="tpl:mb-4 tpl:shrink-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
      >
        {{ t.savedBlocks.saveAsBlock }}
      </h3>

      <!-- Saved block name -->
      <div class="tpl:mb-3 tpl:shrink-0">
        <label
          class="tpl:mb-1.5 tpl:block tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.savedBlocks.name }}
        </label>
        <input
          v-model="name"
          type="text"
          data-testid="saved-blocks-name-input"
          :placeholder="t.savedBlocks.namePlaceholder"
          class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1 tpl:text-sm tpl:shadow-[var(--tpl-shadow-sm)] tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
          :disabled="isSaving"
        />
      </div>

      <!-- Category: free text, with the already-used categories offered as
           suggestions. A datalist rather than a <select> because the set is
           derived from existing entries — there is no registry to pick from,
           and the first entry in a category has to be able to name it. -->
      <div class="tpl:mb-3 tpl:shrink-0">
        <label
          for="tpl-save-block-category"
          class="tpl:mb-1.5 tpl:block tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.savedBlocks.category }}
        </label>
        <input
          id="tpl-save-block-category"
          v-model="category"
          type="text"
          data-testid="saved-blocks-category-input"
          list="tpl-saved-block-categories"
          :placeholder="t.savedBlocks.categoryPlaceholder"
          class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1 tpl:text-sm tpl:shadow-[var(--tpl-shadow-sm)] tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
          :disabled="isSaving"
        />
        <datalist id="tpl-saved-block-categories">
          <option
            v-for="option in savedBlocks.categories.value"
            :key="option"
            :value="option"
          />
        </datalist>
      </div>

      <!-- Summary of what the pick session chose. Which blocks were picked is
           settled on the canvas — the dialog re-presents them only so the user
           can see and order what they're about to save. -->
      <p
        data-testid="saved-blocks-save-summary"
        class="tpl:mb-1.5 tpl:shrink-0 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
      >
        {{ format(t.savedBlocks.savingCount, { count: pickedBlocks.length }) }}
        <span class="tpl:text-[var(--tpl-text-dim)]">{{ summary }}</span>
      </p>

      <!-- Reorderable preview. Seeded in pick order and saved in whatever order
           the list ends up in. Its own Sortable instance with no `group`, so it
           can never exchange items with the canvas or a section column. -->
      <p
        v-if="pickedBlocks.length > 1"
        class="tpl:mb-1.5 tpl:shrink-0 tpl:text-[11px] tpl:text-[var(--tpl-text-dim)]"
      >
        {{ t.savedBlocks.reorderHint }}
      </p>
      <!-- The only growing region: takes whatever the dialog's 90vh cap leaves
           after the fixed chrome, rather than a hand-tuned vh guess that a row
           expanding to full height would blow past. `min-h-0` is what lets a
           flex child actually shrink below its content and scroll. -->
      <VueDraggable
        v-model="orderedBlocks"
        data-testid="saved-blocks-reorder-list"
        :animation="150"
        ghost-class="tpl-ghost"
        drag-class="tpl-dragging"
        handle=".tpl-saved-block-reorder-handle"
        :force-fallback="true"
        class="tpl:mb-4 tpl:flex tpl:min-h-0 tpl:flex-1 tpl:flex-col tpl:gap-1.5 tpl:overflow-y-auto"
      >
        <SavedBlockPreviewRow
          v-for="(block, index) in orderedBlocks"
          :key="block.id"
          :block="block"
          :position="index + 1"
          :total="orderedBlocks.length"
          @move="(delta) => moveBlock(block.id, delta)"
        />
      </VueDraggable>

      <!-- Keyboard reorder announcement region (visually hidden, live) -->
      <div
        class="tpl-sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ announcement }}
      </div>

      <!-- Error message -->
      <p
        v-if="error"
        role="alert"
        class="tpl:mb-3 tpl:shrink-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
      >
        {{ error }}
      </p>

      <!-- Actions -->
      <div class="tpl:flex tpl:shrink-0 tpl:justify-end tpl:gap-2">
        <button
          type="button"
          class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-[var(--tpl-shadow-sm)] tpl:transition-all tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)]"
          :disabled="isSaving"
          :class="{
            'tpl:cursor-not-allowed tpl:opacity-50': isSaving,
          }"
          @click="handleClose"
        >
          {{ t.savedBlocks.cancel }}
        </button>
        <button
          type="button"
          :class="primaryBtnClass"
          :disabled="!canSave"
          @click="handleSave"
        >
          <span v-if="isSaving" class="tpl:flex tpl:items-center tpl:gap-1.5">
            <LoaderCircle
              class="tpl:animate-spin"
              :size="12"
              :stroke-width="2"
            />
            {{ t.savedBlocks.saving }}
          </span>
          <span v-else>
            {{ t.savedBlocks.save }}
          </span>
        </button>
      </div>
    </div>
  </TplModal>
</template>
