<script setup lang="ts">
/**
 * Mount point for the comments sidebar, shared by both entry points.
 *
 * The sidebar is `defineAsyncComponent` behind a `v-if` on its open state, so its
 * chunk is fetched only when the user actually opens the panel. `Editor.vue` in
 * turn lazy-loads *this* wrapper and renders it only when a `CommentsProvider` and
 * a `user` are configured, so a consumer with neither downloads none of it —
 * the `TestEmailPanel` / `SavedBlocksPanels` shape.
 *
 * Never static-import `CommentsSidebar` into `Editor.vue`: that collapses the
 * whole panel into the main entry for every consumer. Guarded by
 * `tests/cdn-chunk-granularity.test.ts`.
 */
import { defineAsyncComponent } from "vue";
import type { UseCommentsFeatureReturn } from "../composables/useCommentsFeature";

defineProps<{
  feature: UseCommentsFeatureReturn;
}>();

const CommentsSidebar = defineAsyncComponent(
  () => import("./CommentsSidebar.vue"),
);
</script>

<template>
  <CommentsSidebar
    v-if="feature.isOpen.value"
    :visible="feature.isOpen.value"
    :feature="feature"
    @close="feature.close()"
  />
</template>
