<script setup lang="ts">
import type {
  ButtonBlock as ButtonBlockType,
  ViewportSize,
} from "@templatical/types";
import { toBorderRadiusCss } from "@templatical/types";
import { computed } from "vue";
import { getBorderStyle } from "../../utils/blockComponentResolver";
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
    // A plain number renders as-is, like the export; per-corner radii go
    // through the renderer's formatter.
    borderRadius:
      typeof props.block.borderRadius === "number"
        ? `${props.block.borderRadius}px`
        : (toBorderRadiusCss(props.block.borderRadius) ?? "0px"),
    textAlign: "center",
  };
  Object.assign(style, getBorderStyle(props.block.border));
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

// Mirrors the renderer's fallback so a template stored before `align` existed
// previews the same way it renders.
const wrapperStyle = computed(() => ({
  textAlign: props.block.align ?? "center",
}));
</script>

<template>
  <div :style="wrapperStyle">
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
