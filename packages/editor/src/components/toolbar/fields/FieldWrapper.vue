<script setup lang="ts">
import { labelClass } from "../../../constants/styleConstants";
import { useI18n } from "../../../composables/useI18n";
import { Lock } from "@lucide/vue";

defineProps<{
  label: string;
  required?: boolean;
  readOnly?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">
      {{ label }}
      <!-- Same treatment as the asterisk below, and the same string the seven
           field components put on the input itself: `readOnly` here is only ever
           `field.readOnly && block.dataSourceFetched`, so "loaded from your data
           source" is the reason, not a generic lock. -->
      <span v-if="readOnly" :title="t.customBlocks.dataSource.readOnlyTooltip">
        <Lock
          :size="12"
          class="tpl:inline tpl:text-[var(--tpl-text-dim)]"
          aria-hidden="true"
        />
        <span class="tpl-sr-only">{{
          t.customBlocks.dataSource.readOnlyTooltip
        }}</span>
      </span>
      <!-- The asterisk is a sighted convention, not a label: on its own it
           announces as "asterisk" or as nothing at all, so the requirement is
           invisible to a screen reader. The glyph is therefore hidden from the
           accessibility tree and the text carried alongside it, which is also
           what makes the state translatable rather than punctuation. -->
      <span
        v-if="required"
        class="tpl:text-[var(--tpl-danger)]"
        :title="t.customBlocks.fields.required"
      >
        <span aria-hidden="true">*</span>
        <span class="tpl-sr-only">{{ t.customBlocks.fields.required }}</span>
      </span>
    </label>
    <slot />
  </div>
</template>
