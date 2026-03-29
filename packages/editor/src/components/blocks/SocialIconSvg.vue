<script setup lang="ts">
import { socialIcons, socialIconSizeMap } from "../../constants/socialIcons";
import type {
  SocialIconSize,
  SocialIconStyle,
  SocialPlatform,
} from "@templatical/types";
import { computed } from "vue";

const props = defineProps<{
  platform: SocialPlatform;
  iconStyle: SocialIconStyle;
  iconSize: SocialIconSize;
}>();

const iconDef = computed(() => socialIcons[props.platform]);
const size = computed(() => socialIconSizeMap[props.iconSize]);

const containerStyle = computed(() => {
  const baseStyles: Record<string, string> = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: `${size.value}px`,
    height: `${size.value}px`,
  };

  switch (props.iconStyle) {
    case "solid":
      return {
        ...baseStyles,
        backgroundColor: iconDef.value.color,
        borderRadius: "4px",
      };
    case "outlined":
      return {
        ...baseStyles,
        backgroundColor: "transparent",
        border: `2px solid ${iconDef.value.color}`,
        borderRadius: "4px",
      };
    case "rounded":
      return {
        ...baseStyles,
        backgroundColor: iconDef.value.color,
        borderRadius: "8px",
      };
    case "square":
      return {
        ...baseStyles,
        backgroundColor: iconDef.value.color,
        borderRadius: "0",
      };
    case "circle":
      return {
        ...baseStyles,
        backgroundColor: iconDef.value.color,
        borderRadius: "50%",
      };
    default:
      return baseStyles;
  }
});

const svgSize = computed(() => Math.floor(size.value * 0.6));

const svgColor = computed(() => {
  if (props.iconStyle === "outlined") {
    return iconDef.value.color;
  }
  return "#ffffff";
});
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
