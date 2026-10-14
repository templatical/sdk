<script setup lang="ts">
import { socialIcons, socialIconSizeMap } from "../../constants/socialIcons";
import type {
  SocialIconTone,
  SocialIconSize,
  SocialIconStyle,
  SocialPlatform,
} from "@templatical/types";
import {
  socialIconColors,
  socialIconGlyphScale,
  socialIconHalo,
} from "@templatical/types";
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
const halo = computed(() => socialIconHalo(props.iconStyle, props.iconTone));

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
        ...(halo.value && { boxShadow: outlineHaloShadow(halo.value) }),
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

const glyphScale = computed(() => socialIconGlyphScale(props.iconStyle));

const svgSize = computed(() => Math.floor(size.value * glyphScale.value));

// The PNG traces both sides of the outline; a shadow outside and one inside
// the border do the same.
function outlineHaloShadow(h: {
  color: string;
  opacity: number;
  width: number;
}) {
  const spread = `${((h.width / 2) * size.value) / 24}px`;
  const alpha = Math.round(h.opacity * 255)
    .toString(16)
    .padStart(2, "0");
  const color = `${h.color}${alpha}`;
  return `0 0 0 ${spread} ${color}, inset 0 0 0 ${spread} ${color}`;
}

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
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        v-if="halo"
        data-testid="social-icon-halo"
        :d="iconDef.path"
        fill="none"
        :stroke="halo.color"
        :stroke-opacity="halo.opacity"
        :stroke-width="halo.width / glyphScale"
        stroke-linejoin="round"
      />
      <path :d="iconDef.path" :fill="svgColor" />
    </svg>
  </span>
</template>
