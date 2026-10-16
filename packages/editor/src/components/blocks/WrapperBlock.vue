<script setup lang="ts">
import {
  backgroundImageHostClass,
  getCachedBlockWrapperStyle,
  getWrapperStyle,
  resolveBlockComponent,
} from "../../utils/blockComponentResolver";
import type {
  Block,
  ViewportSize,
  WrapperBlock as WrapperBlockType,
} from "@templatical/types";
import { SYNTAX_PRESETS } from "@templatical/types";
import { computed, inject, watch } from "vue";
import {
  BLOCK_REGISTRY_KEY,
  IMAGE_URL_RESOLVER_KEY,
  MERGE_TAG_SYNTAX_KEY,
} from "../../keys";
import {
  getBackgroundLookupUrl,
  useResolvedBackgroundUrl,
} from "../../composables/useImageUrlResolver";

defineOptions({ name: "WrapperBlock" });

const props = defineProps<{
  block: WrapperBlockType;
  viewport: ViewportSize;
}>();

const blockRegistry = inject(BLOCK_REGISTRY_KEY, null);
const imageUrlResolver = inject(IMAGE_URL_RESOLVER_KEY, null);
const syntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);

const bandBackgroundUrl = useResolvedBackgroundUrl(
  () => props.block.backgroundImage,
);

const wrapperStyle = computed(
  () =>
    getWrapperStyle(props.block, {
      backgroundImageUrl: bandBackgroundUrl.value,
    }) ?? {},
);

// A child section sits in a plain box here, not a BlockWrapper, so nothing else
// resolves its background image. The lookups start from this band; each box
// then paints the cached result (`getCachedBlockWrapperStyle`). Layout content
// is configuration rather than typed input, so there is no debounce.
const childBackgroundUrls = computed(() =>
  props.block.children.flatMap((child) => {
    const url =
      child.type === "section"
        ? getBackgroundLookupUrl(child.backgroundImage, syntax)
        : undefined;
    return url ? [url] : [];
  }),
);
if (imageUrlResolver) {
  watch(
    childBackgroundUrls,
    (urls) => {
      for (const url of urls) imageUrlResolver.lookup(url);
    },
    { immediate: true },
  );
}

const childBoxes = computed(() =>
  props.block.children.map((child) => ({
    child,
    style: getCachedBlockWrapperStyle(child, imageUrlResolver, syntax),
  })),
);

function getBlockComponent(block: Block) {
  // Children resolve through the registry (title, section, …). No local
  // fallback map: a Canvas import of PreviewSectionBlock (or a preview import
  // of SectionBlock) would pull the other surface's tree into this band.
  return resolveBlockComponent(block, blockRegistry, {});
}
</script>

<template>
  <div
    data-testid="layout-wrapper"
    class="tpl:w-full"
    :style="wrapperStyle"
    :class="backgroundImageHostClass(wrapperStyle)"
  >
    <div
      v-for="{ child, style } in childBoxes"
      :key="child.id"
      :data-block-id="child.id"
      :style="style"
      :class="backgroundImageHostClass(style)"
    >
      <component
        :is="getBlockComponent(child)"
        :block="child"
        :viewport="viewport"
      />
    </div>
  </div>
</template>
