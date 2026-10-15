<script setup lang="ts">
import {
  getBlockWrapperStyle,
  getWrapperStyle,
  resolveBlockComponent,
} from "../../utils/blockComponentResolver";
import type {
  Block,
  ViewportSize,
  WrapperBlock as WrapperBlockType,
} from "@templatical/types";
import { computed, inject } from "vue";
import { BLOCK_REGISTRY_KEY, IMAGE_URL_RESOLVER_KEY } from "../../keys";
import {
  readCachedImageUrl,
  useResolvedImageSrc,
} from "../../composables/useImageUrlResolver";

defineOptions({ name: "WrapperBlock" });

const props = defineProps<{
  block: WrapperBlockType;
  viewport: ViewportSize;
}>();

const blockRegistry = inject(BLOCK_REGISTRY_KEY, null);

const imageUrlResolver = inject(IMAGE_URL_RESOLVER_KEY, null);
const bandBackgroundUrl = useResolvedImageSrc(
  () => props.block.backgroundImage?.url,
);

const wrapperStyle = computed(
  () =>
    getWrapperStyle(props.block, {
      backgroundImageUrl: bandBackgroundUrl.value,
    }) ?? {},
);

/** A child's box style; a child section's image reads the resolver cache. */
function childStyle(child: Block): Record<string, string> {
  return getBlockWrapperStyle(child, {
    backgroundImageUrl:
      child.type === "section"
        ? readCachedImageUrl(imageUrlResolver, child.backgroundImage?.url)
        : undefined,
  });
}

function getBlockComponent(block: Block) {
  // Children resolve through the registry (title, section, …). No local
  // fallback map: a Canvas import of PreviewSectionBlock (or a preview import
  // of SectionBlock) would pull the other surface's tree into this band.
  return resolveBlockComponent(block, blockRegistry, {});
}
</script>

<template>
  <div data-testid="layout-wrapper" class="tpl:w-full" :style="wrapperStyle">
    <div
      v-for="child in block.children"
      :key="child.id"
      :data-block-id="child.id"
      :style="childStyle(child)"
    >
      <component
        :is="getBlockComponent(child)"
        :block="child"
        :viewport="viewport"
      />
    </div>
  </div>
</template>
