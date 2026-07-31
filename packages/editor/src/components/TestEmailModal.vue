<script setup lang="ts">
/**
 * Send-a-test dialog, shared by the OSS and Cloud editors.
 *
 * The recipient control has three shapes, driven entirely by whether the
 * provider configured an allowlist:
 *
 * - **no allowlist** — free text, validated for shape only. This branch exists
 *   for BYO senders; Cloud never takes it, because its list comes from a signed
 *   JWT.
 * - **exactly one** — a read-only field. Preserved verbatim from the Cloud-only
 *   version; there is nothing to choose, so offering an editable field would
 *   imply otherwise.
 * - **several** — a picker of exactly those addresses.
 *
 * An empty allowlist never reaches here: the feature reports itself unavailable,
 * so no trigger renders. (The Cloud-only version fell through to `v-else` and
 * rendered a select with no options and a permanently disabled Send.)
 */
import TplModal from "./TplModal.vue";
// Statically imported: this modal is already lazy-loaded as a whole, so the
// preview rides its chunk rather than costing a second round-trip and flashing
// an empty frame. Still shared with the saved-blocks surfaces, which lazy-load
// it themselves.
import BlockPreviewCanvas from "./BlockPreviewCanvas.vue";
// The editor header's own control, reused verbatim so the two viewport switches
// are the same component rather than two things that resemble each other.
import ViewportToggle from "./ViewportToggle.vue";
import MergeTagModeToggle from "./MergeTagModeToggle.vue";
import { useI18n } from "../composables/useI18n";
import { looksLikeEmail } from "../utils/validateEmailShape";
import { Check, LoaderCircle } from "@lucide/vue";
import { computed, inject, ref, watch } from "vue";
import { hasMergeTagSamples, type ViewportSize } from "@templatical/types";
import { EDITOR_KEY, MERGE_TAGS_KEY, MERGE_TAG_SAMPLE_MODE_KEY } from "../keys";
import type { TestEmailError } from "../composables/useTestEmailFeature";

const props = defineProps<{
  visible: boolean;
  /** Omitted / undefined means unrestricted, so the field accepts free text. */
  allowedRecipients?: string[];
  defaultRecipient?: string;
  isSending: boolean;
  justSent: boolean;
  error: TestEmailError | null;
}>();

const emit = defineEmits<{
  (e: "send", recipient: string): void;
  (e: "close"): void;
}>();

const { t } = useI18n();
const editor = inject(EDITOR_KEY, null);

const recipient = ref("");

const previewViewport = ref<ViewportSize>("desktop");

/**
 * Shared with the editor's own preview, so switching here and switching there
 * are the same choice — it is a property of how the user wants to read a
 * preview, not of one dialog. Falls back to a local ref for headless mounts.
 */
const sharedSampleMode = inject(MERGE_TAG_SAMPLE_MODE_KEY, null);
// Seeded from availability, matching how `useEditorCore` seeds the shared ref.
// A blanket `true` would make the dialog claim tags "show example values" for a
// consumer who configured none — false, and with no toggle rendered to correct
// it, since the toggle hides itself when nothing has a sample.
const localSampleMode = ref(hasMergeTagSamples(inject(MERGE_TAGS_KEY, [])));
const sampleMode = computed({
  get: () => sharedSampleMode?.value ?? localSampleMode.value,
  set: (on: boolean) => {
    if (sharedSampleMode) sharedSampleMode.value = on;
    else localSampleMode.value = on;
  },
});

/**
 * Read live from the editor rather than passed in, so a preview left open while
 * a Cloud collaborator edits stays current. Empty without an editor (headless
 * mounts), which simply renders an empty frame.
 */
const previewBlocks = computed(() => editor?.content.value.blocks ?? []);

const hasAllowlist = computed(
  () =>
    props.allowedRecipients !== undefined && props.allowedRecipients.length > 0,
);
const isSingleRecipient = computed(() => props.allowedRecipients?.length === 1);

// Mounted behind a `v-if` on the same state that drives `visible`, so it can
// mount with `visible` already true — without `immediate` the field would never
// be seeded.
watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    recipient.value =
      props.defaultRecipient ?? props.allowedRecipients?.[0] ?? "";
  },
  { immediate: true },
);

/** Shape-check free text only; a picker can't produce a malformed value. */
const isRecipientValid = computed(() =>
  hasAllowlist.value
    ? recipient.value.length > 0
    : looksLikeEmail(recipient.value),
);

const canSend = computed(
  () => isRecipientValid.value && !props.isSending && !props.justSent,
);

/** Free text that's been typed into but isn't yet a plausible address. */
const showShapeHint = computed(
  () =>
    !hasAllowlist.value &&
    recipient.value.trim().length > 0 &&
    !isRecipientValid.value,
);

const errorText = computed(() => {
  if (!props.error) return null;
  return props.error.kind === "provider"
    ? props.error.message
    : t.testEmail.recipientNotAllowed;
});

function handleSend(): void {
  if (!canSend.value) return;
  emit("send", recipient.value.trim());
}

function handleClose(): void {
  // Sending is the one state that blocks dismissal; the success state closes
  // immediately rather than making the user wait out the timer.
  if (props.isSending) return;
  emit("close");
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
  if (event.key === "Escape") {
    handleClose();
  }
}
</script>

<template>
  <TplModal :visible="visible" @close="handleClose" @keydown="handleKeydown">
    <!-- Grows to `max-w-2xl` only while the preview is open, so a 600px email
         renders at roughly true size — the same reason SaveBlockDialog picked
         that width. Collapsed, it stays the compact form it was. `max-h-[90vh]`
         with a `min-h-0 overflow-y-auto` preview region is the pattern the
         saved-blocks dialogs use: `min-h-0` is what lets a flex child shrink
         below its content and actually scroll. -->
    <div
      role="dialog"
      aria-modal="true"
      :aria-busy="isSending"
      aria-labelledby="tpl-test-email-title"
      class="tpl-scale-in tpl:mx-4 tpl:flex tpl:max-h-[90vh] tpl:w-full tpl:max-w-2xl tpl:flex-col tpl:rounded-[var(--tpl-radius-lg)] tpl:p-5"
      style="
        background-color: var(--tpl-bg-elevated);
        box-shadow: var(--tpl-shadow-xl);
      "
    >
      <h3
        id="tpl-test-email-title"
        class="tpl:mb-4 tpl:shrink-0 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
      >
        {{ t.testEmail.title }}
      </h3>

      <!-- Recipient -->
      <div class="tpl:mb-3 tpl:shrink-0">
        <label
          for="tpl-test-email-recipient"
          class="tpl:mb-1.5 tpl:block tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
        >
          {{ t.testEmail.recipientLabel }}
        </label>

        <!-- Exactly one allowed address: nothing to choose. -->
        <input
          v-if="isSingleRecipient"
          id="tpl-test-email-recipient"
          type="text"
          :value="recipient"
          disabled
          data-testid="test-email-recipient"
          class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1 tpl:text-sm tpl:opacity-70 tpl:shadow-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
        />

        <!-- Several allowed addresses: pick one. -->
        <select
          v-else-if="hasAllowlist"
          id="tpl-test-email-recipient"
          v-model="recipient"
          :disabled="isSending || justSent"
          data-testid="test-email-recipient"
          class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1 tpl:text-sm tpl:shadow-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
        >
          <option
            v-for="email in allowedRecipients"
            :key="email"
            :value="email"
          >
            {{ email }}
          </option>
        </select>

        <!-- No allowlist: free text. -->
        <input
          v-else
          id="tpl-test-email-recipient"
          v-model="recipient"
          type="email"
          autocomplete="email"
          spellcheck="false"
          :placeholder="t.testEmail.recipientPlaceholder"
          :disabled="isSending || justSent"
          data-testid="test-email-recipient"
          class="tpl:h-9 tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1 tpl:text-sm tpl:shadow-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
        />

        <p
          v-if="showShapeHint"
          class="tpl:mt-1.5 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
        >
          {{ t.testEmail.invalidAddress }}
        </p>
      </div>

      <!-- Preview header: a label plus the viewport switch. Always shown — the
           preview is part of the dialog rather than something to opt into. -->
      <div class="tpl:mb-2 tpl:shrink-0">
        <!-- Two segmented controls: `flex-wrap` so they drop to their own row
             rather than crushing the label on a narrow viewport. -->
        <div
          class="tpl:flex tpl:flex-wrap tpl:items-center tpl:justify-between tpl:gap-2"
        >
          <span
            class="tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
          >
            {{ t.testEmail.preview }}
          </span>

          <div class="tpl:flex tpl:items-center tpl:gap-2">
            <MergeTagModeToggle
              :sample-mode="sampleMode"
              @change="sampleMode = $event"
            />

            <!-- Without this the preview would silently show only the desktop
                 variant of any responsive block. -->
            <ViewportToggle
              :viewport="previewViewport"
              @change="previewViewport = $event"
            />
          </div>
        </div>

        <!-- The hint has to follow the mode: "shown unresolved" is simply false
             once every tag renders a realistic value. -->
        <p
          data-testid="test-email-preview-hint"
          class="tpl:mt-1 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
        >
          {{
            sampleMode ? t.testEmail.previewHintSample : t.testEmail.previewHint
          }}
        </p>
      </div>

      <!-- The one region allowed to grow: `flex-1 min-h-0` so it absorbs the
           remaining height and scrolls, leaving the form and actions fixed. -->
      <div
        id="tpl-test-email-preview"
        data-testid="test-email-preview"
        class="tpl:mb-3 tpl:min-h-0 tpl:flex-1 tpl:overflow-y-auto tpl:rounded-[var(--tpl-radius-sm)] tpl:p-3 tpl:bg-[var(--tpl-canvas-bg)]"
      >
        <BlockPreviewCanvas
          :blocks="previewBlocks"
          :viewport="previewViewport"
        />
      </div>

      <!-- Success. Announced politely; the dialog closes itself shortly after. -->
      <p
        v-if="justSent"
        role="status"
        data-testid="test-email-success"
        class="tpl:mb-3 tpl:flex tpl:shrink-0 tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:text-[var(--tpl-success,var(--tpl-primary))]"
      >
        <Check :size="13" :stroke-width="2.5" />
        {{ t.testEmail.success }}
      </p>

      <!-- Failure. Stays open so the user can retry. -->
      <p
        v-else-if="errorText"
        role="alert"
        data-testid="test-email-error"
        class="tpl:mb-3 tpl:shrink-0 tpl:text-xs tpl:text-[var(--tpl-danger)]"
      >
        {{ errorText }}
      </p>

      <!-- Actions -->
      <div class="tpl:flex tpl:shrink-0 tpl:justify-end tpl:gap-2">
        <button
          type="button"
          data-testid="test-email-cancel"
          class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)]"
          :disabled="isSending"
          :class="{ 'tpl:cursor-not-allowed tpl:opacity-50': isSending }"
          @click="handleClose"
        >
          {{ t.testEmail.cancel }}
        </button>
        <button
          type="button"
          data-testid="test-email-send"
          class="tpl:cursor-pointer tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50 tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
          :disabled="!canSend"
          @click="handleSend"
        >
          <span v-if="isSending" class="tpl:flex tpl:items-center tpl:gap-1.5">
            <LoaderCircle
              class="tpl:animate-spin"
              :size="12"
              :stroke-width="2"
            />
            {{ t.testEmail.sending }}
          </span>
          <span v-else>
            {{ t.testEmail.send }}
          </span>
        </button>
      </div>
    </div>
  </TplModal>
</template>
