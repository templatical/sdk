<script setup lang="ts">
/**
 * Mount point for the saved-blocks dialogs, shared by the OSS and Cloud
 * editors.
 *
 * Both dialogs are `defineAsyncComponent`s rendered behind `v-if` on their
 * open state, so their chunks are fetched only when a user actually opens one
 * — `defineAsyncComponent` triggers its `import()` on first render, not at
 * definition time. The editors in turn lazy-load *this* wrapper and render it
 * only when a `SavedBlocksProvider` is configured, so a consumer without one
 * downloads none of it.
 */
import { defineAsyncComponent } from "vue";
import type { SavedBlock } from "@templatical/types";
import type { UseSavedBlocksFeatureReturn } from "../composables/useSavedBlocksFeature";

const props = defineProps<{
  feature: UseSavedBlocksFeatureReturn;
}>();

const SaveBlockDialog = defineAsyncComponent(
  () => import("./SaveBlockDialog.vue"),
);
const SavedBlocksBrowserModal = defineAsyncComponent(
  () => import("./SavedBlocksBrowserModal.vue"),
);

function handleInsert(
  saved: SavedBlock,
  insertIndex: number | undefined,
): void {
  props.feature.insert(saved, insertIndex);
}
</script>

<template>
  <SaveBlockDialog
    v-if="feature.isSaveDialogOpen.value"
    :visible="feature.isSaveDialogOpen.value"
    :pre-selected-block-id="feature.preSelectedBlockId.value"
    @close="feature.closeSaveDialog()"
    @saved="feature.refresh()"
  />

  <SavedBlocksBrowserModal
    v-if="feature.isBrowserOpen.value"
    :visible="feature.isBrowserOpen.value"
    @close="feature.closeBrowser()"
    @insert="handleInsert"
  />
</template>
