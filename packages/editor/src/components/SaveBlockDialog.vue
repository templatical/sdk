<script setup lang="ts">
import TplModal from "./TplModal.vue";
import { useI18n } from "../composables";
import { EDITOR_KEY, SAVED_BLOCKS_KEY, requireInject } from "../keys";
import { LoaderCircle } from "@lucide/vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  /**
   * Blocks chosen during the canvas pick session. Order is irrelevant — the
   * saved content is derived in document order below — but every id must be a
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

const name = ref("");
const isSaving = ref(false);
const error = ref<string | null>(null);

/**
 * The picked blocks in **document order**, regardless of the order they were
 * clicked in — filtering the canvas list is what guarantees that. Ids that no
 * longer resolve (a block deleted mid-session) simply drop out.
 */
const pickedBlocks = computed(() => {
  const picked = new Set(props.pickedIds);
  return editor.content.value.blocks.filter((b) => picked.has(b.id));
});

/** e.g. "Title, Paragraph, Button" — what the user is about to save. */
const summary = computed(() =>
  pickedBlocks.value
    .map((b) => {
      const typeKey = b.type as keyof typeof t.blocks;
      return t.blocks[typeKey] ?? b.type;
    })
    .join(", "),
);

// `immediate` matters: the dialog is mounted lazily behind a `v-if` on the
// same state that drives `visible`, so it can mount with `visible` already
// true and would otherwise never reset the name field.
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      name.value = "";
      error.value = null;
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
    await savedBlocks.create(name.value.trim(), blocks);
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
      class="tpl-scale-in tpl:mx-4 tpl:w-full tpl:max-w-sm tpl:rounded-[var(--tpl-radius-lg)] tpl:p-5"
      style="
        background-color: var(--tpl-bg-elevated);
        box-shadow: var(--tpl-shadow-xl);
      "
    >
      <h3
        id="tpl-save-block-title"
        class="tpl:mb-4 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
      >
        {{ t.savedBlocks.saveAsBlock }}
      </h3>

      <!-- Saved block name -->
      <div class="tpl:mb-3">
        <label
          class="tpl:mb-1.5 tpl:block tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.savedBlocks.name }}
        </label>
        <input
          v-model="name"
          type="text"
          :placeholder="t.savedBlocks.namePlaceholder"
          class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1 tpl:text-sm tpl:shadow-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
          :disabled="isSaving"
        />
      </div>

      <!-- Read-only summary of what the pick session chose. The picking already
           happened on the canvas, so re-presenting it as an editable list would
           reintroduce the ambiguity that flow exists to avoid. -->
      <p
        data-testid="saved-blocks-save-summary"
        class="tpl:mb-4 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
      >
        {{ format(t.savedBlocks.savingCount, { count: pickedBlocks.length }) }}
        <span class="tpl:text-[var(--tpl-text-dim)]">{{ summary }}</span>
      </p>

      <!-- Error message -->
      <p
        v-if="error"
        role="alert"
        class="tpl:mb-3 tpl:text-xs tpl:text-[var(--tpl-danger)]"
      >
        {{ error }}
      </p>

      <!-- Actions -->
      <div class="tpl:flex tpl:justify-end tpl:gap-2">
        <button
          type="button"
          class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)]"
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
          class="tpl:cursor-pointer tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50 tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
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
