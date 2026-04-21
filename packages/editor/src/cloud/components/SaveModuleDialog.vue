<script setup lang="ts">
import TplModal from "./TplModal.vue";
import { useI18n } from "../../composables";
import {
  EDITOR_KEY,
  SAVED_MODULES_HEADLESS_KEY,
  requireInject,
} from "../../keys";
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
const editor = requireInject(EDITOR_KEY, "SaveModuleDialog");
const savedModules = requireInject(
  SAVED_MODULES_HEADLESS_KEY,
  "SaveModuleDialog",
);

const moduleName = ref("");
const selectedBlockIds = ref<Set<string>>(new Set());
const isSaving = ref(false);
const error = ref<string | null>(null);

const topLevelBlocks = computed(() => editor.content.value.blocks);

function blockLabel(block: Block, index: number): string {
  const typeKey = block.type as keyof typeof t.blocks;
  const label = t.blocks[typeKey] ?? block.type;
  return `${label} ${index + 1}`;
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      moduleName.value = "";
      error.value = null;
      selectedBlockIds.value = new Set(
        props.preSelectedBlockId ? [props.preSelectedBlockId] : [],
      );
    }
  },
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
    moduleName.value.trim().length > 0 &&
    selectedBlockIds.value.size > 0 &&
    !isSaving.value,
);

async function handleSave(): Promise<void> {
  if (!canSave.value) return;

  isSaving.value = true;
  error.value = null;

  try {
    const selectedBlocks = topLevelBlocks.value.filter((b) =>
      selectedBlockIds.value.has(b.id),
    );
    await savedModules.createModule(moduleName.value.trim(), selectedBlocks);
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
      aria-labelledby="tpl-save-module-title"
      class="tpl-scale-in tpl:mx-4 tpl:w-full tpl:max-w-sm tpl:rounded-[var(--tpl-radius-lg)] tpl:p-5"
      style="
        background-color: var(--tpl-bg-elevated);
        box-shadow: var(--tpl-shadow-xl);
      "
    >
      <h3
        id="tpl-save-module-title"
        class="tpl:mb-4 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
      >
        {{ t.modules.saveAsModule }}
      </h3>

      <!-- Module name -->
      <div class="tpl:mb-3">
        <label
          class="tpl:mb-1.5 tpl:block tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.modules.moduleName }}
        </label>
        <input
          v-model="moduleName"
          type="text"
          :placeholder="t.modules.moduleNamePlaceholder"
          class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1 tpl:text-sm tpl:shadow-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
          :disabled="isSaving"
        />
      </div>

      <!-- Block selection -->
      <div class="tpl:mb-3">
        <label
          class="tpl:mb-1.5 tpl:block tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.modules.selectBlocks }}
        </label>
        <div
          class="tpl:max-h-40 tpl:space-y-1 tpl:overflow-y-auto tpl:rounded-md tpl:border tpl:p-2 tpl:border-[var(--tpl-border)]"
        >
          <label
            v-for="(block, index) in topLevelBlocks"
            :key="block.id"
            class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:rounded-sm tpl:px-2 tpl:py-1.5 tpl:text-sm tpl:transition-colors tpl:duration-100"
            :style="{
              color: 'var(--tpl-text)',
              backgroundColor: selectedBlockIds.has(block.id)
                ? 'var(--tpl-primary-light)'
                : 'transparent',
            }"
          >
            <input
              type="checkbox"
              :checked="selectedBlockIds.has(block.id)"
              class="tpl:accent-[var(--tpl-primary)]"
              :disabled="isSaving"
              @change="toggleBlock(block.id)"
            />
            {{ blockLabel(block, index) }}
          </label>
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
          {{ t.modules.cancel }}
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
            {{ t.modules.saving }}
          </span>
          <span v-else>
            {{ t.modules.save }}
          </span>
        </button>
      </div>
    </div>
  </TplModal>
</template>
