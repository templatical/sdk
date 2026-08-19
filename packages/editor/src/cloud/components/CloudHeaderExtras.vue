<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { Sparkles } from "@lucide/vue";

import { useCloudI18nStrict } from "../../composables/useCloudI18n";
import type { CloudAttachment } from "../runtime";

const CollaboratorBar = defineAsyncComponent(
  () => import("./CollaboratorBar.vue"),
);
const AiFeatureMenu = defineAsyncComponent(() => import("./AiFeatureMenu.vue"));

/**
 * The Cloud-only header controls, filled into `EditorHeader`'s three
 * `*-extras` slots.
 *
 * One component with a `part` prop rather than three: the three regions share
 * this file's lazy chunk, so a Cloud session pays one round-trip for all of them
 * and an OSS session pays none.
 *
 * The plan-usage readout and the AI button live here rather than in the shared
 * header because they render **cloud-chunk** strings; OSS translators never see
 * them. Comments are deliberately not here: that feature is shared and
 * provider-backed, so its trigger and its strings belong to the shared header and
 * the OSS chunk.
 */
defineProps<{
  part: "left" | "center" | "right";
  cloud: CloudAttachment;
}>();

const { t: cloudT, format: cloudFormat } = useCloudI18nStrict();
</script>

<template>
  <!-- Left: templates used / allowed. A plan *limit*, not a templates concern,
       which is why it sits here and its string stays in the cloud chunk. -->
  <span
    v-if="part === 'left' && cloud.featureFlags.templateLimit.value !== null"
    data-testid="cloud-template-usage"
    class="tpl:text-xs tpl:opacity-60 tpl:text-[var(--tpl-text-muted)]"
  >
    {{
      cloudFormat(cloudT.header.templatesUsed, {
        used: cloud.featureFlags.templateCount.value,
        max: cloud.featureFlags.templateLimit.value,
      })
    }}
  </span>

  <!-- Center: who else is in the template right now. -->
  <CollaboratorBar
    v-else-if="
      part === 'center' &&
      cloud.collaboration &&
      cloud.isCollaborationEnabled.value
    "
    :collaborators="cloud.collaboration.collaborators.value"
    :is-connected="cloud.websocket.isConnected.value"
  />

  <!-- Right: AI — after the shared header's Comments button and before the
       test-email button, so the shared header is a superset of the OSS one rather
       than a rearrangement. -->
  <template v-else-if="part === 'right'">
    <div
      v-if="
        cloud.featureFlags.canUseAiGeneration.value &&
        cloud.featureFlags.hasTemplateSaved.value
      "
      :ref="
        (el) => (cloud.panelState.aiMenuRef.value = el as HTMLElement | null)
      "
      class="tpl:relative"
    >
      <button
        type="button"
        data-testid="ai-menu-trigger"
        :aria-expanded="cloud.panelState.aiMenuOpen.value"
        class="tpl-ai-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-4 tpl:py-2 tpl:text-sm tpl:font-semibold tpl:whitespace-nowrap tpl:transition-all tpl:duration-200"
        :class="
          cloud.panelState.aiButtonActive.value
            ? 'tpl-ai-btn--active'
            : 'tpl-ai-btn--idle'
        "
        @click.stop="cloud.panelState.toggleAiMenu"
      >
        <Sparkles :size="16" :stroke-width="2" class="tpl-ai-btn-icon" />
        {{ cloudT.aiChat.button }}
      </button>
      <Transition
        enter-active-class="tpl:transition-all tpl:ease-out"
        enter-from-class="tpl:scale-95 tpl:opacity-0"
        enter-to-class="tpl:scale-100 tpl:opacity-100"
        leave-active-class="tpl:transition-all tpl:duration-100 tpl:ease-in"
        leave-from-class="tpl:scale-100 tpl:opacity-100"
        leave-to-class="tpl:scale-95 tpl:opacity-0"
      >
        <div
          v-if="cloud.panelState.aiMenuOpen.value"
          class="tpl:absolute tpl:right-0 tpl:top-full tpl:z-50 tpl:mt-1 tpl:origin-top-right"
        >
          <AiFeatureMenu
            :active-feature="cloud.panelState.activeAiFeature.value"
            @select="cloud.panelState.handleAiFeatureSelect"
          />
        </div>
      </Transition>
    </div>
  </template>
</template>
