<script setup lang="ts">
import type {
  ButtonBlock as ButtonBlockType,
  ViewportSize,
} from "@templatical/types";
import { computed } from "vue";
import MergeTagPreviewText from "../MergeTagPreviewText.vue";

const props = defineProps<{
  block: ButtonBlockType;
  viewport: ViewportSize;
}>();

const buttonStyle = computed(() => {
  const style: Record<string, string> = {
    display: "inline-block",
    padding: `${props.block.buttonPadding.top}px ${props.block.buttonPadding.right}px ${props.block.buttonPadding.bottom}px ${props.block.buttonPadding.left}px`,
    backgroundColor: props.block.backgroundColor,
    color: props.block.textColor,
    fontSize: `${props.block.fontSize}px`,
    fontWeight: "bold",
    textDecoration: "none",
    borderRadius: `${props.block.borderRadius}px`,
    textAlign: "center",
  };
  if (props.block.fontFamily) {
    style.fontFamily = props.block.fontFamily;
  }
  if (props.block.width === "full") {
    style.display = "block";
    style.width = "100%";
    style.boxSizing = "border-box";
  } else if (typeof props.block.width === "number") {
    style.width = `${props.block.width}px`;
    style.boxSizing = "border-box";
  }
  return style;
});
</script>

<template>
  <div class="tpl:text-center">
    <a
      :href="block.url || '#'"
      :style="buttonStyle"
      class="tpl:cursor-default"
      @click.prevent
    >
      <MergeTagPreviewText :text="block.text" />
    </a>
  </div>
</template>
