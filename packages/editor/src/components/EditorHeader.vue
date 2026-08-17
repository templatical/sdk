<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { LoaderCircle, MessageCircle, Save, Send } from "@lucide/vue";

import type {
  BaseEditorReturn,
  UseEditorCoreReturn,
} from "../composables/useEditorCore";
import type { UseCommentsFeatureReturn } from "../composables/useCommentsFeature";
import type { UseTemplatesFeatureReturn } from "../composables/useTemplatesFeature";
import type { UseTestEmailFeatureReturn } from "../composables/useTestEmailFeature";
import type { UseVersionHistoryFeatureReturn } from "../composables/useVersionHistoryFeature";
import { headerBtnClass } from "../constants/styleConstants";

import ViewportToggle from "./ViewportToggle.vue";
import DarkModeToggle from "./DarkModeToggle.vue";
import PreviewToggle from "./PreviewToggle.vue";
import MergeTagModeToggle from "./MergeTagModeToggle.vue";
import TemplateNameField from "./TemplateNameField.vue";
import TemplateSaveStatus from "./TemplateSaveStatus.vue";

// Lazy: an editor with no `versionHistory` provider never downloads the control.
const VersionHistoryMenu = defineAsyncComponent(
  () => import("./VersionHistoryMenu.vue"),
);

/**
 * The editor's one header. Both entry points render this — `initCloud()` adds its
 * own controls through the three `*-extras` slots rather than through a second
 * header component, which is what keeps the two layouts from drifting apart
 * again (they already had: only Cloud carried `min-w-[200px]`, so the OSS centre
 * column was never actually centred).
 *
 * Everything here is capability-driven, so the same markup covers "no providers
 * configured at all" and a fully-wired Cloud session. Nothing in this file knows
 * that Cloud exists.
 */
defineProps<{
  editor: BaseEditorReturn;
  core: UseEditorCoreReturn;
  /** Null when no `TemplatesProvider` is configured — no name, save or status. */
  templates: UseTemplatesFeatureReturn | null;
  testEmail: UseTestEmailFeatureReturn | null;
  versionHistory: UseVersionHistoryFeatureReturn | null;
  /** Null when no `CommentsProvider` (or no `user`) is configured. */
  comments: UseCommentsFeatureReturn | null;
}>();
</script>

<template>
  <header
    class="tpl-header tpl:absolute tpl:top-0 tpl:right-0 tpl:left-0 tpl:z-50 tpl:grid tpl:h-14 tpl:grid-cols-[1fr_auto_1fr] tpl:items-center tpl:px-4 tpl:shadow-[var(--tpl-shadow-md)] tpl:border-b tpl:border-[var(--tpl-border)]"
    style="
      background-color: color-mix(in srgb, var(--tpl-bg) 80%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    "
  >
    <!-- Left: the template's name, inline-editable. `min-w-[200px]` matches the
         right column so the centre controls are actually centred. Rendered only
         once a template exists — there is nothing to name before that. -->
    <div
      class="tpl-header-left tpl:flex tpl:min-w-[200px] tpl:items-center tpl:gap-2.5"
    >
      <TemplateNameField
        v-if="templates?.isAvailable.value && templates.hasTemplate.value"
        :name="templates.name.value"
        :editable="templates.canSave.value"
        @commit="templates.rename"
      />
      <slot name="left-extras" />
    </div>

    <!-- Center: viewport + dark mode + preview + merge-tag view + history -->
    <div
      class="tpl-header-center tpl:flex tpl:items-center tpl:justify-center tpl:gap-10"
    >
      <ViewportToggle
        :viewport="editor.state.viewport"
        @change="editor.setViewport"
      />
      <DarkModeToggle
        :dark-mode="editor.state.darkMode"
        @change="editor.setDarkMode"
      />
      <PreviewToggle
        :preview-mode="editor.state.previewMode"
        @change="editor.setPreviewMode"
      />
      <!-- Preview mode only. Merge tags are never substituted on the editing
           canvas, so offering the choice there would be a control with no
           effect. -->
      <MergeTagModeToggle
        v-if="
          editor.state.previewMode &&
          !core.previewResolution.supersedesSamples.value
        "
        :sample-mode="core.mergeTagSampleMode.value"
        @change="core.mergeTagSampleMode.value = $event"
      />
      <slot name="center-extras" />
      <!-- Version history. Needs a template as well as a provider: a version
           belongs to a template id, so before one is loaded there is nothing the
           control could list. -->
      <VersionHistoryMenu
        v-if="
          versionHistory?.isAvailable.value && versionHistory.hasTemplate.value
        "
        :versions="versionHistory.versions.value"
        :is-loading="versionHistory.isLoading.value"
        :is-restoring="versionHistory.isRestoring.value"
        :previewing-id="versionHistory.previewingVersion.value?.id ?? null"
        @open="versionHistory.refresh()"
        @navigate="versionHistory.navigate($event)"
      />
    </div>

    <!-- Right: save status → Comments → [cloud extras: AI] → test email → Save.
         Save is last: it is the primary action. -->
    <div
      class="tpl-header-right tpl:flex tpl:min-w-[200px] tpl:items-center tpl:justify-end tpl:gap-3"
    >
      <!-- Gated on a provider that can actually save. Without one the editor
           never learns that a save completed, so the badge could only ever read
           "unsaved" — worse than showing nothing. -->
      <TemplateSaveStatus
        v-if="templates?.isAvailable.value && templates.canSave.value"
        :status="templates.status.value"
        :error-message="templates.errorMessage.value"
        :is-dirty="editor.state.isDirty"
      />

      <!-- Comments. Needs a template as well as a provider — a comment is keyed
           to a template id, so before one is loaded there is nothing to attach a
           thread to. Shared chrome, because comments are a shared
           provider-backed feature rather than a Cloud one. -->
      <button
        v-if="comments?.isAvailable.value && comments.hasTemplate.value"
        type="button"
        data-testid="comments-trigger"
        :aria-label="
          comments.unresolvedCount.value > 0
            ? `${core.t.comments.button} (${comments.unresolvedCount.value})`
            : core.t.comments.button
        "
        :aria-expanded="comments.isOpen.value"
        :class="headerBtnClass"
        :style="{
          backgroundColor: comments.isOpen.value
            ? 'var(--tpl-primary)'
            : 'transparent',
          color: comments.isOpen.value ? 'var(--tpl-bg)' : 'var(--tpl-primary)',
          borderColor: 'var(--tpl-primary)',
        }"
        @click="comments.toggle()"
      >
        <MessageCircle :size="16" :stroke-width="2" />
        {{ core.t.comments.button }}
        <span
          v-if="comments.unresolvedCount.value > 0 && !comments.isOpen.value"
          class="tpl:inline-flex tpl:size-4.5 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-[10px] tpl:font-semibold tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
        >
          {{ comments.unresolvedCount.value }}
        </span>
      </button>

      <slot name="right-extras" />

      <!-- A real button — border, surface fill and `shadow-xs`, the same subtle
           elevation `inputClass` uses — but coloured down: muted text rather
           than full-strength `--tpl-text`, and no primary tint until hover. It
           reads as a raised control against the header's translucent backdrop
           while staying clearly secondary; sending a test is not the page's
           primary action. Recipe follows `removeItemBtnClass` (border + surface
           + muted text) with elevation added. -->
      <button
        v-if="testEmail?.isAvailable.value"
        type="button"
        data-testid="test-email-trigger"
        :aria-label="core.t.testEmail.title"
        :title="core.t.testEmail.title"
        :disabled="testEmail.isSending.value"
        class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] hover:tpl:bg-[var(--tpl-bg-hover)] hover:tpl:text-[var(--tpl-text)] tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
        @click="testEmail.open()"
      >
        <Send
          v-if="!testEmail.isSending.value"
          :size="14"
          :stroke-width="1.75"
        />
        <LoaderCircle v-else class="tpl-spinner" :size="14" :stroke-width="2" />
        {{ core.t.testEmail.button }}
      </button>

      <!-- Save. Hidden entirely when the provider withheld `save` — the
           read-only equivalent of the saved-blocks permission discipline:
           loading a template and editing it locally still works, there is
           simply nothing to persist. Disabled (with a reason in the tooltip)
           until a template exists, since `save()` patches an id. -->
      <button
        v-if="templates?.isAvailable.value && templates.canSave.value"
        type="button"
        data-testid="template-save"
        :class="headerBtnClass"
        style="
          background-color: transparent;
          color: var(--tpl-primary);
          border-color: var(--tpl-primary);
        "
        :disabled="templates.isSaving.value || !templates.hasTemplate.value"
        :title="
          templates.hasTemplate.value
            ? core.t.header.save
            : core.t.header.saveNoTemplate
        "
        @click="templates.requestSave()"
      >
        <Save v-if="!templates.isSaving.value" :size="16" :stroke-width="2" />
        <LoaderCircle v-else class="tpl-spinner" :size="16" :stroke-width="2" />
        {{
          templates.isSaving.value ? core.t.header.saving : core.t.header.save
        }}
      </button>
    </div>
  </header>
</template>
