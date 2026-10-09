<script setup lang="ts">
import { socialIcons, socialIconSizeMap } from "../../constants/socialIcons";
import type {
  SocialIconTone,
  SocialIconSize,
  SocialIconStyle,
  SocialPlatform,
} from "@templatical/types";
import { socialIconColors, socialIconGlyphScale } from "@templatical/types";
import { computed } from "vue";

const props = defineProps<{
  platform: SocialPlatform;
  iconStyle: SocialIconStyle;
  iconTone?: SocialIconTone;
  iconSize: SocialIconSize;
}>();

const iconDef = computed(() => socialIcons[props.platform]);
const size = computed(() => socialIconSizeMap[props.iconSize]);
// The same colors the renderer's PNGs are drawn in.
const colors = computed(() => socialIconColors(props.platform, props.iconTone));

const containerStyle = computed(() => {
  const baseStyles: Record<string, string> = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: `${size.value}px`,
    height: `${size.value}px`,
  };
  const fill = colors.value.fill;

  switch (props.iconStyle) {
    case "solid":
      return {
        ...baseStyles,
        backgroundColor: fill,
        borderRadius: "4px",
      };
    case "outlined":
      return {
        ...baseStyles,
        backgroundColor: "transparent",
        border: `2px solid ${fill}`,
        borderRadius: "4px",
      };
    case "rounded":
      return {
        ...baseStyles,
        backgroundColor: fill,
        borderRadius: "8px",
      };
    case "square":
      return {
        ...baseStyles,
        backgroundColor: fill,
        borderRadius: "0",
      };
    case "circle":
      return {
        ...baseStyles,
        backgroundColor: fill,
        borderRadius: "50%",
      };
    default:
      return baseStyles;
  }
});

const svgSize = computed(() =>
  Math.floor(size.value * socialIconGlyphScale(props.iconStyle)),
);

const svgColor = computed(() =>
  props.iconStyle === "outlined" || props.iconStyle === "plain"
    ? colors.value.fill
    : colors.value.onFill,
);
</script>

<template>
  <span :style="containerStyle">
    <svg
      :width="svgSize"
      :height="svgSize"
      viewBox="0 0 24 24"
      :fill="svgColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path :d="iconDef.path" />
    </svg>
  </span>
</template>
