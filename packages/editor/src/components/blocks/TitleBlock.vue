<script setup lang="ts">
import { useEditableTextBlock } from "../../composables/useEditableTextBlock";
import type {
  TitleBlock as TitleBlockType,
  ViewportSize,
} from "@templatical/types";
import { HEADING_LEVEL_FONT_SIZE } from "@templatical/types";
import { computed, defineAsyncComponent } from "vue";

const props = defineProps<{
  block: TitleBlockType;
  viewport: ViewportSize;
}>();

const TitleEditor = defineAsyncComponent(() => import("./TitleEditor.vue"));

const {
  isEditing,
  blockRef,
  toolbarPosition,
  resolvedContent,
  handleDoubleClick,
  handleEditorDone,
} = useEditableTextBlock(() => props.block.content);

const titleStyle = computed(() => {
  const fontSize = HEADING_LEVEL_FONT_SIZE[props.block.level];
  const style: Record<string, string> = {
    fontSize: `${fontSize}px`,
    color: props.block.color,
    textAlign: props.block.textAlign,
  };
  if (props.block.fontFamily) {
    style.fontFamily = props.block.fontFamily;
  }
  return style;
});
</script>

<template>
  <div
    ref="blockRef"
    class="tpl:min-h-[1em] tpl:w-full"
    :style="titleStyle"
    @dblclick="handleDoubleClick"
  >
    <TitleEditor
      v-if="isEditing"
      :block="block"
      :toolbar-position="toolbarPosition"
      @done="handleEditorDone"
    />
    <!-- eslint-disable vue/no-v-html -->
    <div
      v-else
      class="tpl-text-content tpl:outline-none [&_a]:tpl:underline [&_p]:tpl:m-0 [&_p]:tpl:mb-2 [&_p:last-child]:tpl:mb-0"
      v-html="resolvedContent"
    />
    <!-- eslint-enable vue/no-v-html -->
  </div>
</template>
