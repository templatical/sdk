<script setup lang="ts">
/**
 * Mount point for the version-history chrome that sits outside the header,
 * shared by the OSS and Cloud editors.
 *
 * Same shape as `SavedBlocksPanels.vue` / `TestEmailPanel.vue`: everything here
 * is `defineAsyncComponent` behind a `v-if` on its own state, and the editors in
 * turn lazy-load *this* wrapper and render it only when a
 * `VersionHistoryProvider` is configured — so a consumer without one downloads
 * none of it.
 *
 * The header's dropdown control is not here for one reason only: it has to sit
 * in the header's centre column. It is lazily imported at those two sites
 * instead, and covered by the same CDN chunk guard.
 */
import { defineAsyncComponent } from "vue";
import type { UseVersionHistoryFeatureReturn } from "../composables/useVersionHistoryFeature";

const props = defineProps<{
  feature: UseVersionHistoryFeatureReturn;
}>();

const VersionPreviewBanner = defineAsyncComponent(
  () => import("./VersionPreviewBanner.vue"),
);
// Its own chunk, fetched only if a restore is attempted with unsaved work —
// which for a Cloud session (autosave on) is the uncommon case.
const RestoreVersionDialog = defineAsyncComponent(
  () => import("./RestoreVersionDialog.vue"),
);

/**
 * Every action here swallows its rejection: the feature already reported it
 * through `onError` and rolled the canvas back, and an unhandled rejection out
 * of a DOM event binding helps nobody.
 */
async function handleRequestRestore(): Promise<void> {
  try {
    await props.feature.requestRestore();
  } catch {
    /* reported through onError */
  }
}

async function handleSaveAndRestore(): Promise<void> {
  try {
    await props.feature.saveAndRestore();
  } catch {
    /* reported through onError */
  }
}

async function handleDiscardAndRestore(): Promise<void> {
  try {
    await props.feature.discardAndRestore();
  } catch {
    /* reported through onError */
  }
}
</script>

<template>
  <VersionPreviewBanner
    v-if="feature.isPreviewing.value"
    :visible="feature.isPreviewing.value"
    :can-restore="feature.canRestore.value"
    @cancel="feature.cancelPreview()"
    @confirm="handleRequestRestore"
  />

  <RestoreVersionDialog
    v-if="feature.isConfirmingRestore.value"
    :visible="feature.isConfirmingRestore.value"
    :can-save="feature.canSaveBeforeRestore.value"
    :is-busy="feature.isConfirmBusy.value"
    @cancel="feature.cancelRestoreConfirm()"
    @save-and-restore="handleSaveAndRestore"
    @discard-and-restore="handleDiscardAndRestore"
  />
</template>
