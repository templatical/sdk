<script setup lang="ts">
import type {
  SpacerBlock as SpacerBlockType,
  ViewportSize,
} from "@templatical/types";
import { computed, inject } from "vue";
import { EDITOR_KEY } from "../../keys";

const props = defineProps<{
  block: SpacerBlockType;
  viewport: ViewportSize;
}>();

const editor = inject(EDITOR_KEY)!;

const spacerStyle = computed(() => ({
  height: `${props.block.height}px`,
  minHeight: `${props.block.height}px`,
  ...(editor.state.previewMode ? {} : { borderColor: "var(--tpl-border)" }),
}));
</script>

<template>
  <div class="tpl:w-full">
    <div
      :style="spacerStyle"
      class="tpl:relative tpl:flex tpl:items-center tpl:justify-center"
      :class="{
        'tpl:border-y tpl:border-dashed': !editor.state.previewMode,
      }"
    >
      <span
        v-if="!editor.state.previewMode"
        class="tpl:absolute tpl:rounded tpl:px-2 tpl:py-0.5 tpl:text-[10px] tpl:font-medium"
        style="
          background-color: var(--tpl-bg-hover);
          color: var(--tpl-text-dim);
        "
      >
        {{ block.height }}px
      </span>
    </div>
  </div>
</template>
