<script setup lang="ts">
import { useMergeTag } from "../../composables/useMergeTag";
import type {
  MergeTag,
  TextBlock as TextBlockType,
  ViewportSize,
} from "@templatical/types";
import {
  resolveHtmlLogicMergeTagLabels,
  resolveHtmlMergeTagLabels,
} from "@templatical/types";
import { useEventListener } from "@vueuse/core";
import { computed, defineAsyncComponent, inject, ref, watchEffect } from "vue";

const props = defineProps<{
  block: TextBlockType;
  viewport: ViewportSize;
}>();

const TextEditor = defineAsyncComponent(() => import("./TextEditor.vue"));

const mergeTags = inject<MergeTag[]>("mergeTags", []);
const { syntax } = useMergeTag();

const resolvedContent = computed(() =>
  resolveHtmlLogicMergeTagLabels(
    resolveHtmlMergeTagLabels(props.block.content, mergeTags),
    syntax,
  ),
);

const isEditing = ref(false);
const textBlockRef = ref<HTMLElement | null>(null);
const toolbarPosition = ref({ top: 0, left: 0 });

function updateToolbarPosition(): void {
  if (!textBlockRef.value) return;
  const rect = textBlockRef.value.getBoundingClientRect();
  toolbarPosition.value = {
    top: rect.top - 8,
    left: rect.left,
  };
}

const textStyle = computed(() => {
  const style: Record<string, string> = {
    fontSize: `${props.block.fontSize}px`,
    color: props.block.color,
    textAlign: props.block.textAlign,
    fontWeight: props.block.fontWeight,
  };
  if (props.block.fontFamily) {
    style.fontFamily = props.block.fontFamily;
  }
  return style;
});

function handleDoubleClick(): void {
  updateToolbarPosition();
  isEditing.value = true;
}

function handleEditorDone(): void {
  isEditing.value = false;
}

watchEffect((onCleanup) => {
  if (!isEditing.value) return;
  const stopScroll = useEventListener(
    window,
    "scroll",
    updateToolbarPosition,
    true,
  );
  const stopResize = useEventListener(window, "resize", updateToolbarPosition);
  onCleanup(() => {
    stopScroll();
    stopResize();
  });
});
</script>

<template>
  <div
    ref="textBlockRef"
    class="tpl:min-h-[1em] tpl:w-full"
    :style="textStyle"
    @dblclick="handleDoubleClick"
  >
    <TextEditor
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
