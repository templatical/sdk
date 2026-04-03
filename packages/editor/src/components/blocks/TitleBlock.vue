<script setup lang="ts">
import { useMergeTag } from "../../composables/useMergeTag";
import type {
  MergeTag,
  TitleBlock as TitleBlockType,
  ViewportSize,
} from "@templatical/types";
import { HEADING_LEVEL_FONT_SIZE } from "@templatical/types";
import {
  resolveHtmlLogicMergeTagLabels,
  resolveHtmlMergeTagLabels,
} from "@templatical/types";
import { useElementBounding } from "@vueuse/core";
import { computed, defineAsyncComponent, inject, ref } from "vue";

const props = defineProps<{
  block: TitleBlockType;
  viewport: ViewportSize;
}>();

const TitleEditor = defineAsyncComponent(() => import("./TitleEditor.vue"));

const mergeTags = inject<MergeTag[]>("mergeTags", []);
const { syntax } = useMergeTag();

const resolvedContent = computed(() =>
  resolveHtmlLogicMergeTagLabels(
    resolveHtmlMergeTagLabels(props.block.content, mergeTags),
    syntax,
  ),
);

const isEditing = ref(false);
const titleBlockRef = ref<HTMLElement | null>(null);
const { top: boundingTop, left: boundingLeft } =
  useElementBounding(titleBlockRef);
const toolbarPosition = computed(() => ({
  top: boundingTop.value - 8,
  left: boundingLeft.value,
}));

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

function handleDoubleClick(): void {
  isEditing.value = true;
}

function handleEditorDone(): void {
  isEditing.value = false;
}
</script>

<template>
  <div
    ref="titleBlockRef"
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
