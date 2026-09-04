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
      class="tpl-text-content tpl:outline-none"
      v-html="resolvedContent"
    />
    <!-- eslint-enable vue/no-v-html -->
  </div>
</template>
