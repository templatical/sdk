<script setup lang="ts">
/**
 * Mount point for the media library modal.
 *
 * The modal is `defineAsyncComponent` behind a `v-if` on its open state, so its
 * chunk is fetched only when the user actually opens Browse —
 * `defineAsyncComponent` triggers its `import()` on first render, not at
 * definition time. `Editor.vue` in turn lazy-loads *this* wrapper and renders
 * it only when a `MediaProvider` is configured, so a consumer without one
 * downloads none of it. A callback-only `onRequestMedia` never mounts this.
 *
 * Never static-import `MediaLibraryModal` into `Editor.vue`: that collapses
 * the optional peer into the main entry for every consumer. Guarded by
 * `tests/editorMediaProvider.test.ts`.
 *
 * The try/catch around the dynamic import downgrades Webpack's
 * "Module not found" from error to warning when the optional peer isn't
 * installed. Consumers who configured a provider still need the package.
 */
import { defineAsyncComponent } from "vue";
import type { MediaAsset, MediaProvider } from "@templatical/types";
import type { UseMediaFeatureReturn } from "../composables/useMediaFeature";

const props = defineProps<{
  feature: UseMediaFeatureReturn;
  provider: MediaProvider;
  locale?: string;
  uiTheme?: string;
  popoverTarget?: HTMLElement | null;
}>();

const MediaLibraryModal = defineAsyncComponent(async () => {
  try {
    const m = await import("@templatical/media-library");
    return m.MediaLibraryModal;
  } catch {
    throw new Error(
      "[Templatical] The media library requires the optional peer dependency '@templatical/media-library'. Please install it.",
    );
  }
});

function handleSelect(asset: MediaAsset): void {
  props.feature.select(asset);
}
</script>

<template>
  <MediaLibraryModal
    v-if="feature.isModalOpen.value"
    :visible="feature.isModalOpen.value"
    :provider="provider"
    :accept="feature.accept.value"
    :popover-target="popoverTarget"
    :locale="locale"
    :ui-theme="uiTheme"
    :template-id="feature.templateId.value"
    :on-error="feature.onError"
    @select="handleSelect"
    @close="feature.close()"
  />
</template>
