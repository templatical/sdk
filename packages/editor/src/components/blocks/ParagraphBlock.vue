<script setup lang="ts">
import { useEditableTextBlock } from "../../composables/useEditableTextBlock";
import type {
  ParagraphBlock as ParagraphBlockType,
  ViewportSize,
} from "@templatical/types";
import { defineAsyncComponent } from "vue";

const props = defineProps<{
  block: ParagraphBlockType;
  viewport: ViewportSize;
}>();

const ParagraphEditor = defineAsyncComponent(
  () => import("./ParagraphEditor.vue"),
);

const {
  isEditing,
  blockRef,
  toolbarPosition,
  resolvedContent,
  handleDoubleClick,
  handleEditorDone,
} = useEditableTextBlock(() => props.block.content);
</script>

<template>
  <div
    ref="blockRef"
    class="tpl:min-h-[1em] tpl:w-full"
    @dblclick="handleDoubleClick"
  >
    <ParagraphEditor
      v-if="isEditing"
      :block="block"
      :toolbar-position="toolbarPosition"
      @done="handleEditorDone"
    />
    <!-- eslint-disable vue/no-v-html -->
    <div
      v-else
      class="tpl-text-content tpl:outline-none [&_a]:tpl:underline [&_li]:tpl:my-1 [&_ol]:tpl:my-2 [&_ol]:tpl:pl-6 [&_p]:tpl:m-0 [&_p]:tpl:mb-2 [&_p:last-child]:tpl:mb-0 [&_s]:tpl:line-through [&_sub]:tpl:align-sub [&_sub]:tpl:text-[0.75em] [&_sup]:tpl:align-super [&_sup]:tpl:text-[0.75em] [&_ul]:tpl:my-2 [&_ul]:tpl:pl-6"
      v-html="resolvedContent"
    />
    <!-- eslint-enable vue/no-v-html -->
  </div>
</template>
