<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import {
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../../constants/styleConstants";
import type { SpacerBlock } from "@templatical/types";

defineProps<{
  block: SpacerBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<SpacerBlock>): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.spacer.height }}</label>
    <div class="tpl:flex tpl:items-stretch">
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="block.height"
        min="10"
        max="100"
        @input="
          emit('update', {
            height: Number(($event.target as HTMLInputElement).value),
          })
        "
      />
      <span :class="inputSuffixClass">px</span>
    </div>
    <input
      type="range"
      class="tpl:mt-2 tpl:w-full tpl:accent-[var(--tpl-primary)]"
      :value="block.height"
      min="10"
      max="100"
      @input="
        emit('update', {
          height: Number(($event.target as HTMLInputElement).value),
        })
      "
    />
  </div>
</template>
