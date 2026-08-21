<script setup lang="ts">
/**
 * Mount point for the test-email dialog, shared by the OSS and Cloud editors.
 *
 * The dialog is `defineAsyncComponent` behind a `v-if` on its open state, so its
 * chunk is fetched only when the user actually opens it — `defineAsyncComponent`
 * triggers its `import()` on first render, not at definition time. `Editor.vue`
 * in turn lazy-loads *this* wrapper and renders it only when a
 * `TestEmailProvider` is configured, so a consumer without one downloads none
 * of it.
 *
 * Never static-import `TestEmailModal` into `Editor.vue`:
 * that collapses it into the main entry for every consumer, including those who
 * never configure a sender. Guarded by `tests/cdn-chunk-granularity.test.ts`.
 */
import { defineAsyncComponent } from "vue";
import type { UseTestEmailFeatureReturn } from "../composables/useTestEmailFeature";

const props = defineProps<{
  feature: UseTestEmailFeatureReturn;
}>();

const TestEmailModal = defineAsyncComponent(
  () => import("./TestEmailModal.vue"),
);

function handleSend(recipient: string): void {
  void props.feature.send(recipient);
}
</script>

<template>
  <TestEmailModal
    v-if="feature.isModalOpen.value"
    :visible="feature.isModalOpen.value"
    :allowed-recipients="feature.allowedRecipients.value"
    :default-recipient="feature.defaultRecipient.value"
    :is-sending="feature.isSending.value"
    :just-sent="feature.justSent.value"
    :error="feature.error.value"
    @send="handleSend"
    @close="feature.close()"
  />
</template>
