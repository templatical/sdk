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
      <Lock
        v-if="readOnly"
        :size="12"
        class="tpl:inline tpl:text-[var(--tpl-text-dim)]"
      />
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
