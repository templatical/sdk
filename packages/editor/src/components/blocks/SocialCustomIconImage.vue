<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { useMergeTag } from "../../composables/useMergeTag";
import { useResolvedImageSrc } from "../../composables/useImageUrlResolver";
import { socialIconSizeMap } from "../../constants/socialIcons";
import type { CustomSocialIcon, SocialIconSize } from "@templatical/types";
import { containsMergeTag } from "@templatical/types";
import { Image } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  icon: CustomSocialIcon;
  iconSize: SocialIconSize;
}>();

const { t } = useI18n();
const { syntax } = useMergeTag();

const size = computed(() => socialIconSizeMap[props.iconSize]);
const glyphSize = computed(() => Math.round(size.value / 2));

// Stored content can omit imageUrl or hold a non-string. Both are empty.
const imageUrl = computed(() =>
  typeof props.icon.imageUrl === "string" ? props.icon.imageUrl : "",
);

// A merge-tag imageUrl names no file the canvas can paint, same as an image
// block's src, so it stays out of the resolver and the placeholder shows.
const hasMergeTagSrc = computed(() => containsMergeTag(imageUrl.value, syntax));
const displaySrc = useResolvedImageSrc(() =>
  hasMergeTagSrc.value || imageUrl.value.trim() === ""
    ? undefined
    : imageUrl.value,
);
</script>

<template>
  <img
    v-if="displaySrc"
    :src="displaySrc"
    :alt="icon.alt ?? ''"
    :width="size"
    :style="{ display: 'block', height: 'auto' }"
  />
  <div
    v-else
    role="img"
    :aria-label="t.social.customIconMissing"
    class="tpl:box-border tpl:flex tpl:items-center tpl:justify-center tpl:border tpl:border-dashed tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-text-dim)]"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <Image :size="glyphSize" :stroke-width="1.5" aria-hidden="true" />
  </div>
</template>
