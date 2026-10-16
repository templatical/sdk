<script setup lang="ts">
import { useEditableTextBlock } from "../../composables/useEditableTextBlock";
import type {
  TitleBlock as TitleBlockType,
  ViewportSize,
} from "@templatical/types";
import {
  HEADING_LEVEL_FONT_SIZE,
  TITLE_FONT_WEIGHT,
  TITLE_LINE_HEIGHT,
} from "@templatical/types";
import { computed, defineAsyncComponent } from "vue";
import { unwrapParagraph } from "../../utils/unwrapParagraph";
import { FONTS_MANAGER_KEY, requireInject } from "../../keys";

const props = defineProps<{
  block: TitleBlockType;
  viewport: ViewportSize;
}>();

const TitleEditor = defineAsyncComponent(() => import("./TitleEditor.vue"));

const fontsManager = requireInject(FONTS_MANAGER_KEY, "TitleBlock");

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
    // On the wrapper so the view heading and the edit surface inherit the
    // same values the renderer writes onto the title's `mj-text` and heading.
    lineHeight: String(TITLE_LINE_HEIGHT),
    fontWeight: String(TITLE_FONT_WEIGHT),
    textAlign: props.block.textAlign,
  };
  // Unset color = inherit the canvas text color (the document `textColor`).
  if (props.block.color) {
    style.color = props.block.color;
  }
  if (props.block.fontFamily) {
    style.fontFamily = fontsManager.resolveFontFamily(props.block.fontFamily);
  }
  return style;
});

const headingTag = computed(() => `h${props.block.level}`);
const headingHtml = computed(() => unwrapParagraph(resolvedContent.value));
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
    <!-- eslint-disable vue/no-v-html, vue/no-v-text-v-html-on-component -->
    <component
      :is="headingTag"
      v-else
      class="tpl-text-content tpl:m-0 tpl:font-[inherit] tpl:text-[length:inherit] tpl:leading-[inherit] tpl:outline-none"
      :style="{ color: 'inherit', fontWeight: 'inherit' }"
      v-html="headingHtml"
    />
    <!-- eslint-enable vue/no-v-html, vue/no-v-text-v-html-on-component -->
  </div>
</template>
