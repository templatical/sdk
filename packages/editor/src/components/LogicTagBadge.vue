<script setup lang="ts">
import {
  getLogicMergeTagKeyword,
  isLogicMergeTagValue,
  type SyntaxPreset,
} from "@templatical/types";
import { computed } from "vue";

// Small outlined keyword chip (IF, ENDIF, FOR…) shown next to a tag in the
// merge tag picker and the typing-autocomplete list. It marks a configured
// tag whose `value` is a logic tag rather than a data tag, so authors can
// tell at a glance which entries insert control flow. The visual mirrors the
// on-canvas logic badge (outlined, primary color) for consistency. Renders
// nothing when the value isn't logic-shaped, so callers can drop it into any
// row unconditionally.
const props = defineProps<{ value: string; syntax: SyntaxPreset }>();

const isLogic = computed(() => isLogicMergeTagValue(props.value, props.syntax));
const keyword = computed(() =>
  getLogicMergeTagKeyword(props.value, props.syntax),
);
</script>

<template>
  <span
    v-if="isLogic"
    class="tpl:inline-flex tpl:flex-shrink-0 tpl:items-center tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:leading-none tpl:font-bold tpl:tracking-wide tpl:uppercase"
    style="
      border: 1.5px solid
        color-mix(in srgb, var(--tpl-primary) 50%, transparent);
      color: var(--tpl-primary);
    "
    data-testid="merge-tag-logic-badge"
    :data-logic-keyword="keyword"
  >
    {{ keyword }}
  </span>
</template>
