<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { labelClass } from "../../constants/styleConstants";
import type { HtmlBlock } from "@templatical/types";
import { Info } from "@lucide/vue";

defineProps<{
  block: HtmlBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<HtmlBlock>): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.html.content }}</label>
    <textarea
      :value="block.content"
      :placeholder="'<div>...</div>'"
      rows="10"
      class="tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2.5 tpl:py-2 tpl:font-mono tpl:text-xs tpl:text-[var(--tpl-text)] tpl:transition-all tpl:duration-150 tpl:outline-none tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]"
      @input="
        emit('update', {
          content: ($event.target as HTMLTextAreaElement).value,
        })
      "
    />
    <p
      class="tpl:mt-1.5 tpl:flex tpl:items-start tpl:gap-1.5 tpl:text-[11px] tpl:text-[var(--tpl-text-dim)]"
    >
      <Info :size="12" class="tpl:mt-0.5 tpl:shrink-0" />
      {{ t.html.sanitizationHint }}
    </p>
  </div>
</template>
