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
import {
  primaryBtnCompactClass,
  secondaryBtnCompactClass,
} from "../constants/styleConstants";

import ViewportToggle from "./ViewportToggle.vue";
import DarkModeToggle from "./DarkModeToggle.vue";
import PreviewToggle from "./PreviewToggle.vue";
import TemplateNameField from "./TemplateNameField.vue";
import TemplateTimestamp from "./TemplateTimestamp.vue";
import TemplateSaveStatus from "./TemplateSaveStatus.vue";

// Lazy: an editor with no `versionHistory` provider never downloads the control.
const VersionHistoryMenu = defineAsyncComponent(
  () => import("./VersionHistoryMenu.vue"),
);

/**
 * The editor's one header. Both entry points render this — `initCloud()` adds its
 * own controls through the `left-extras` / `right-extras` slots rather than
 * through a second header component, which is what keeps the two layouts from
 * drifting apart again (they already had: only Cloud carried `min-w-[200px]`, so
 * the OSS centre column was never actually centred).
 *
 * The two slots are in the anchored columns on purpose. There is deliberately no
 * centre slot: that track's width must stay constant, and a slot is the one
 * thing a guard test cannot stop someone filling. See the centre column's own
 * comment for why width changes there move the Preview button.
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
  /**
   * Whether to render the inline name field, from `config.templates?.nameField`.
   * False hides it whether or not the provider can save — a consumer whose
   * store has no name column, or whose own chrome owns the name.
   */
  showTemplateName: boolean;
  testEmail: UseTestEmailFeatureReturn | null;
  versionHistory: UseVersionHistoryFeatureReturn | null;
  /** Null when no `CommentsProvider` (or no `user`) is configured. */
  comments: UseCommentsFeatureReturn | null;
}>();
</script>

<template>
  <!-- Opaque, and `--tpl-shadow-sm` because that is the step the shadow
       vocabulary assigns to sticky chrome. `.tpl-body` starts at this header's
       own height, so nothing ever passes beneath it: a translucent fill has an
       identical surface behind it and a backdrop blur has nothing to blur,
       which costs a compositing layer to render exactly `--tpl-bg`. -->
  <header
    class="tpl-header tpl:absolute tpl:top-0 tpl:right-0 tpl:left-0 tpl:z-50 tpl:grid tpl:h-14 tpl:grid-cols-[1fr_auto_1fr] tpl:items-center tpl:px-4 tpl:bg-[var(--tpl-bg)] tpl:shadow-[var(--tpl-shadow-sm)] tpl:border-b tpl:border-[var(--tpl-border)]"
  >
    <!-- Left: the template's identity — the inline-editable name, and under it
         when the store dates its writes. Stacking the two needs 6px of bottom
         padding: the name is a button, so it carries border + `py-1` + half its
         leading above its text, while the timestamp carries nothing below its
         own. Centring the boxes therefore puts all of that lead at the top and
         reads as a misaligned pair. Only when both render — either alone is
         already centred on its own box. `min-w-[200px]` matches the right column
         so the centre controls are actually centred. Nothing renders before a
         template exists; there is neither a name nor a write time yet. The stack
         is gated as a whole so an empty one cannot add a `gap-2.5` before the
         cloud extras. -->
    <div
      class="tpl-header-left tpl:flex tpl:min-w-[200px] tpl:items-center tpl:gap-2.5"
    >
      <div
        v-if="
          templates?.isAvailable.value &&
          templates.hasTemplate.value &&
          (showTemplateName || templates.timestamp.value)
        "
        class="tpl:flex tpl:min-w-0 tpl:flex-col tpl:items-start"
        :class="{
          'tpl:pb-1.5': showTemplateName && templates.timestamp.value !== null,
        }"
      >
        <TemplateNameField
          v-if="showTemplateName"
          :name="templates.name.value"
          :editable="templates.canSave.value"
          @commit="templates.rename"
        />
        <TemplateTimestamp
          v-if="templates.timestamp.value"
          :iso="templates.timestamp.value.iso"
          :kind="templates.timestamp.value.kind"
        />
      </div>
      <!-- Version history — the third piece of "which template, and which
           version of it", after the name and the write time. It sits here and
           not in the right column because that column's content already
           overflows its track: `justify-end` packs to the right edge, so an
           extra control there spills *leftward* over the centre track and
           swallows clicks meant for the Preview button. Measured — it covered
           it with the menu's own back-arrow. This column packs from the left
           and has the room.

           Needs a template as well as a provider: a version belongs to a
           template id, so before one is loaded there is nothing to list. -->
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
      <slot name="left-extras" />
    </div>

    <!-- Center: the three "how am I viewing the canvas" controls, and nothing
         else — ever.

         The grid is `1fr auto 1fr`, so this track is exactly max-content wide
         and the equal `fr` columns centre it. Any width change therefore
         redistributes symmetrically about the header's centre and moves every
         sibling by half the delta, whichever side of the change it sits on.
         DOM order buys nothing. So a conditional control here drags the Preview
         button out from under the cursor — 114.5px when the sample/label toggle
         used to live here, and repeatedly in Cloud as collaborators came and
         went (#574).

         Hence the rule: nothing in this track may be conditional. No `v-if`, no
         `v-show`, no slot. Conditional controls go in the edge-anchored `fr`
         columns, which grow away from their anchored edge; preview-only ones go
         on the preview surface, where `Editor.vue` floats them over the canvas.
         Locked by `tests/headerCenterStability.test.ts`. -->
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
    </div>

    <!-- Right: save status → Comments → [cloud extras: AI] → test email → Save.
         Save is last: it is the primary action. `justify-end` anchors the row to
         the right edge, so a control appearing at its start extends the row
         leftward and moves nothing already in it — but note the row is already
         at the edge of its track at common widths, so anything added here
         overflows onto the centre rather than fitting. -->
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
        :class="secondaryBtnCompactClass"
        :style="
          comments.isOpen.value
            ? {
                backgroundColor: 'var(--tpl-primary-light)',
                borderColor: 'var(--tpl-primary-light)',
              }
            : undefined
        "
        @click="comments.toggle()"
      >
        <MessageCircle :size="16" :stroke-width="2" />
        {{ core.t.comments.button }}
        <span
          v-if="comments.unresolvedCount.value > 0 && !comments.isOpen.value"
          class="tpl:inline-flex tpl:size-4.5 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-[10px] tpl:font-semibold tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-on-primary)]"
        >
          {{ comments.unresolvedCount.value }}
        </span>
      </button>

      <slot name="right-extras" />

      <!-- The shared recipe, like every control in this row. Shared rather than
           hand-rolled so all three keep one height — a bespoke string is how
           this button came to sit 4px shorter than its neighbours. -->
      <button
        v-if="testEmail?.isAvailable.value"
        type="button"
        data-testid="test-email-trigger"
        :aria-label="core.t.testEmail.title"
        :title="core.t.testEmail.title"
        :disabled="testEmail.isSending.value"
        :class="secondaryBtnCompactClass"
        @click="testEmail.open()"
      >
        <Send v-if="!testEmail.isSending.value" :size="16" :stroke-width="2" />
        <LoaderCircle v-else class="tpl-spinner" :size="16" :stroke-width="2" />
        {{ core.t.testEmail.button }}
      </button>

      <!-- Save is the editor's one primary, and it only takes that treatment
           while there is something to save. Amber announces intent or selection,
           so a Save that looks identical dirty or clean announces nothing — and
           it would be the loudest element in chrome that exists to recede behind
           the canvas. Gated on `hasTemplate` too, or a disabled button would
           light up before there is anywhere to save to.

           Amber with the paper colour on it is 2.80:1 in light mode. That is
           accepted rather than overlooked: every amber surface and accent in the
           editor shares this pairing, and correcting this one control alone would
           make it read as a different kind of thing. The Amber-Accent Exception
           in DESIGN.md records the decision and its limits — chief among them
           that amber must never be the only carrier of a state, which is why the
           `TemplateSaveStatus` badge says "Unsaved" in words beside it.

           The light lift is the same condition, and it is Flat-At-Rest applied
           rather than bent: a surface paints no shadow until something happens to
           it, and unsaved work is that something. It sits inline rather than in
           the recipe because the recipe is shared, and a primary button at rest
           elsewhere should still be flat.

           Hidden entirely when the provider withheld `save` — the read-only
           equivalent of the saved-blocks permission discipline: loading a
           template and editing it locally still works, there is simply nothing
           to persist. Disabled (with a reason in the tooltip) until a template
           exists, since `save()` patches an id. -->
      <button
        v-if="templates?.isAvailable.value && templates.canSave.value"
        type="button"
        data-testid="template-save"
        :class="
          editor.state.isDirty && templates.hasTemplate.value
            ? primaryBtnCompactClass
            : secondaryBtnCompactClass
        "
        :style="
          editor.state.isDirty && templates.hasTemplate.value
            ? { boxShadow: 'var(--tpl-shadow-sm)' }
            : undefined
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
