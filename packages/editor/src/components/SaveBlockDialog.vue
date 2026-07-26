<script setup lang="ts">
import TplModal from "./TplModal.vue";
import ToggleSwitch from "./ToggleSwitch.vue";
import { useI18n } from "../composables";
import { EDITOR_KEY, SAVED_BLOCKS_KEY, requireInject } from "../keys";
import type { Block } from "@templatical/types";
import { LoaderCircle } from "@lucide/vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  preSelectedBlockId: string | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved"): void;
}>();

const { t } = useI18n();
const editor = requireInject(EDITOR_KEY, "SaveBlockDialog");
const savedBlocks = requireInject(SAVED_BLOCKS_KEY, "SaveBlockDialog");

const name = ref("");
const selectedBlockIds = ref<Set<string>>(new Set());
const isSaving = ref(false);
const error = ref<string | null>(null);

const topLevelBlocks = computed(() => editor.content.value.blocks);

function blockLabel(block: Block, index: number): string {
  const typeKey = block.type as keyof typeof t.blocks;
  const label = t.blocks[typeKey] ?? block.type;
  return `${label} ${index + 1}`;
}

// `immediate` matters: the dialog is mounted lazily behind a `v-if` on the
// same state that drives `visible`, so it can mount with `visible` already
// true and would otherwise never seed the pre-selection.
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      name.value = "";
      error.value = null;
      // Only honor a pre-selection that's actually in the list. `openSaveDialog`
      // is reachable programmatically, so the id may be stale or (before the
      // nested-block guard) point at a section child — seeding it anyway would
      // show an empty checklist while making Save look valid.
      const preSelected = props.preSelectedBlockId;
      const selectable =
        preSelected !== null &&
        topLevelBlocks.value.some((b) => b.id === preSelected);
      selectedBlockIds.value = new Set(selectable ? [preSelected] : []);
    }
  },
  { immediate: true },
);

function toggleBlock(blockId: string): void {
  const newSet = new Set(selectedBlockIds.value);
  if (newSet.has(blockId)) {
    newSet.delete(blockId);
  } else {
    newSet.add(blockId);
  }
  selectedBlockIds.value = newSet;
}

const canSave = computed(
  () =>
    name.value.trim().length > 0 &&
    selectedBlockIds.value.size > 0 &&
    !isSaving.value,
);

async function handleSave(): Promise<void> {
  if (!canSave.value) return;

  const selectedBlocks = topLevelBlocks.value.filter((b) =>
    selectedBlockIds.value.has(b.id),
  );
  // Defence in depth: if the selection resolves to nothing, bail rather than
  // persist an empty saved block (which would list as "0 block(s)" and insert
  // nothing). Guards any caller that seeds an id we can't resolve.
  if (selectedBlocks.length === 0) return;

  isSaving.value = true;
  error.value = null;

  try {
    await savedBlocks.create(name.value.trim(), selectedBlocks);
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

      <!-- Block selection -->
      <div class="tpl:mb-3">
        <label
          class="tpl:mb-1.5 tpl:block tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.savedBlocks.selectBlocks }}
        </label>
        <div
          class="tpl:max-h-40 tpl:space-y-1 tpl:overflow-y-auto tpl:rounded-md tpl:border tpl:p-2 tpl:border-[var(--tpl-border)]"
        >
          <ToggleSwitch
            v-for="(block, index) in topLevelBlocks"
            :key="block.id"
            class="tpl:rounded-sm tpl:px-2 tpl:py-1.5 tpl:text-sm tpl:transition-colors tpl:duration-100"
            :style="{
              color: 'var(--tpl-text)',
              backgroundColor: selectedBlockIds.has(block.id)
                ? 'var(--tpl-primary-light)'
                : 'transparent',
            }"
            :model-value="selectedBlockIds.has(block.id)"
            :label="blockLabel(block, index)"
            :disabled="isSaving"
            @update:model-value="toggleBlock(block.id)"
          />
        </div>
      </div>

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
