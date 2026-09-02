<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import {
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../../constants/styleConstants";
import type { ParagraphBlock } from "@templatical/types";
import { RICH_TEXT_SPACING } from "@templatical/types";

defineProps<{
  block: ParagraphBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ParagraphBlock>): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="tpl:mb-3.5" data-testid="paragraph-spacing">
    <label :class="labelClass">{{ t.paragraph.paragraphSpacing }}</label>
    <div class="tpl:flex tpl:items-stretch">
      <!-- Shows the built-in gap when the block sets none, so the field always
           reads the gap actually in effect rather than an empty box. -->
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="block.paragraphSpacing ?? RICH_TEXT_SPACING.paragraphGap"
        min="0"
        max="64"
        @input="
          emit('update', {
            paragraphSpacing: Number(($event.target as HTMLInputElement).value),
          })
        "
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </div>
</template>
