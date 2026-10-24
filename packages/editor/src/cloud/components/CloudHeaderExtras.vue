<script setup lang="ts">
import { useCloudI18nStrict } from "../../composables/useCloudI18n";
import type { CloudAttachment } from "../runtime";

/**
 * The Cloud-only header control, filled into `EditorHeader`'s `left-extras`
 * slot. `Editor.vue` still mounts the `right` part, which renders nothing until
 * Cloud's next right-hand control (S7 and S8 on the `cloud` branch).
 *
 * This control lives in a lazy chunk, so a Cloud session pays one round-trip
 * for it and an OSS session pays none.
 *
 * There is no `center` part. The header's centre track must hold a constant
 * width, so only the anchored columns take conditional controls — see
 * `EditorHeader.vue`'s centre comment.
 *
 * The plan-usage readout lives here rather than in the shared header because
 * it renders a **cloud-chunk** string; OSS translators never see it. Comments
 * and the collaborator bar are deliberately not here: both are shared and
 * provider-backed, so their controls and strings belong to the shared header
 * and the OSS chunk.
 */
defineProps<{
  part: "left" | "right";
  cloud: CloudAttachment;
}>();

const { t: cloudT, format: cloudFormat } = useCloudI18nStrict();
</script>

<template>
  <!-- Left: the plan's template usage. -->
  <template v-if="part === 'left'">
    <!-- A plan *limit*, not a templates concern, which is why it sits here and
         its string stays in the cloud chunk. -->
    <span
      v-if="cloud.featureFlags.templateLimit.value !== null"
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
  </template>
</template>
