<script setup lang="ts">
/**
 * Mount point for the saved-blocks UI, shared by the OSS and Cloud editors.
 *
 * Everything here is `defineAsyncComponent` rendered behind `v-if` on its own
 * state, so each chunk is fetched only when actually needed —
 * `defineAsyncComponent` triggers its `import()` on first render, not at
 * definition time. The editors in turn lazy-load *this* wrapper and render it
 * only when a `SavedBlocksProvider` is configured, so a consumer without one
 * downloads none of it.
 *
 * The pick bar lives here rather than in `Editor.vue` / `CloudEditor.vue` so
 * neither editor needs to know about saved blocks, and the lazy-load guarantee
 * covers the bar too.
 */
import { defineAsyncComponent } from "vue";
import type { SavedBlock } from "@templatical/types";
import type { UseSavedBlocksFeatureReturn } from "../composables/useSavedBlocksFeature";

const props = defineProps<{
  feature: UseSavedBlocksFeatureReturn;
}>();

const SavedBlocksPickBar = defineAsyncComponent(
  () => import("./SavedBlocksPickBar.vue"),
);
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
  <SavedBlocksPickBar
    v-if="feature.isPicking.value"
    :count="feature.pickedCount.value"
    @confirm="feature.confirmPicking()"
    @cancel="feature.cancelPicking()"
  />

  <SaveBlockDialog
    v-if="feature.isSaveDialogOpen.value"
    :visible="feature.isSaveDialogOpen.value"
    :picked-ids="[...feature.pickedIds.value]"
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
