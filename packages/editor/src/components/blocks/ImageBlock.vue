<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { useMergeTag } from "../../composables/useMergeTag";
import type {
  ImageBlock as ImageBlockType,
  MediaResult,
  ViewportSize,
} from "@templatical/types";
import {
  containsMergeTag,
  toBorderCss,
  toBorderRadiusCss,
} from "@templatical/types";
import { getBorderStyle } from "../../utils/blockComponentResolver";
import MediaDropOverlay from "../MediaDropOverlay.vue";
import MergeTagPreviewText from "../MergeTagPreviewText.vue";
import { Image } from "@lucide/vue";
import { computed, ref } from "vue";
import { useMediaDropField } from "../../composables/useMediaDropField";
import { useResolvedImageSrc } from "../../composables/useImageUrlResolver";

const props = defineProps<{
  block: ImageBlockType;
  viewport: ViewportSize;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ImageBlockType>): void;
}>();

const { t } = useI18n();
const { syntax } = useMergeTag();

const hasMergeTagSrc = computed(() =>
  containsMergeTag(props.block.src, syntax),
);

function applyMedia(result: MediaResult): void {
  const updates: Partial<ImageBlockType> = { src: result.url };
  if (result.alt) updates.alt = result.alt;
  emit("update", updates);
}

const dropZoneRef = ref<HTMLElement>();
const { canBrowse, dropEnabled, isUploading, showOverlay, openMediaBrowser } =
  useMediaDropField({
    target: dropZoneRef,
    // A merge-tag src is a deliberate dynamic value — never clobber it via drop.
    blocked: hasMergeTagSrc,
    apply: applyMedia,
  });

const containerStyle = computed(() => ({
  textAlign: props.block.align,
}));

// MJML sizes a full-width `<img>` to the column minus its left and right
// borders, so the bordered image still fits the column. Mirror that for
// `"full"` only: a fixed pixel width already matches the export, and a blanket
// `box-sizing: border-box` would also shrink an explicit height relative to
// the email. Only drawn sides count.
const fullWidth = computed(() => {
  const border = props.block.border;
  const horizontal = (["left", "right"] as const)
    .map((side) =>
      toBorderCss(border?.[side]) === null ? 0 : border![side].width,
    )
    .reduce((a, b) => a + b, 0);
  return horizontal > 0 ? `calc(100% - ${horizontal}px)` : "100%";
});

const imageStyle = computed(() => {
  const align = props.block.align;
  return {
    maxWidth: "100%",
    width:
      props.block.width === "full" ? fullWidth.value : `${props.block.width}px`,
    // No object-fit: email clients don't support it, so a stored height has to
    // stretch here exactly as it will in the recipient's inbox.
    height: props.block.height ? `${props.block.height}px` : undefined,
    // The renderer's own formatter: neither the toolbar nor the importers can
    // produce a negative, but hand-authored JSON can, and the canvas must not
    // paint a radius the export omits.
    borderRadius: toBorderRadiusCss(props.block.borderRadius) ?? undefined,
    ...getBorderStyle(props.block.border),
    display: "block",
    marginLeft: align === "center" || align === "right" ? "auto" : undefined,
    marginRight: align === "center" ? "auto" : undefined,
  };
});

// Display-only preview URLs (#415). The canonical values stay in block.src /
// block.placeholderUrl (and thus in the MJML export) — the resolver only
// changes what the canvas <img> shows. A merge-tag src is never displayable,
// so it's opted out of resolution; its placeholder preview resolves instead.
const displaySrc = useResolvedImageSrc(() =>
  hasMergeTagSrc.value ? undefined : props.block.src,
);
const displayPlaceholderUrl = useResolvedImageSrc(() =>
  hasMergeTagSrc.value ? props.block.placeholderUrl : undefined,
);
</script>

<template>
  <div
    ref="dropZoneRef"
    data-testid="image-drop-zone"
    :data-drop-enabled="dropEnabled"
    class="tpl:relative tpl:w-full"
    :style="containerStyle"
  >
    <MediaDropOverlay
      v-if="showOverlay"
      :uploading="isUploading"
      size="canvas"
    />
    <!-- Placeholder with preview image provided -->
    <template v-if="block.src && hasMergeTagSrc && block.placeholderUrl">
      <a
        v-if="block.linkUrl"
        :href="block.linkUrl"
        target="_blank"
        rel="noopener noreferrer"
        @click.prevent
      >
        <img
          class="tpl:border-0"
          loading="lazy"
          :src="displayPlaceholderUrl"
          :alt="block.alt || t.image.altTextPlaceholder"
          :style="imageStyle"
        />
      </a>
      <img
        v-else
        class="tpl:border-0"
        :src="displayPlaceholderUrl"
        :alt="block.alt"
        :style="imageStyle"
      />
    </template>
    <!-- Placeholder visual (no preview image) -->
    <div
      v-else-if="block.src && hasMergeTagSrc"
      class="tpl:!flex tpl:min-h-[120px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-center tpl:bg-[var(--tpl-bg-elevated)]"
      style="
        border-color: color-mix(in srgb, var(--tpl-primary) 40%, transparent);
      "
      :style="imageStyle"
    >
      <Image
        :size="32"
        :stroke-width="1.5"
        class="tpl:text-[var(--tpl-primary)]"
        style="opacity: 0.5"
      />
      <span
        class="tpl:max-w-full tpl:truncate tpl:px-3 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-primary)]"
        style="opacity: 0.7"
      >
        <MergeTagPreviewText :text="block.src" />
      </span>
    </div>
    <!-- Normal image rendering -->
    <template v-else-if="block.src">
      <a
        v-if="block.linkUrl"
        :href="block.linkUrl"
        target="_blank"
        rel="noopener noreferrer"
        @click.prevent
      >
        <img
          class="tpl:border-0"
          loading="lazy"
          :src="displaySrc"
          :alt="block.alt || t.image.altTextPlaceholder"
          :style="imageStyle"
        />
      </a>
      <img
        v-else
        class="tpl:border-0"
        :src="displaySrc"
        :alt="block.alt"
        :style="imageStyle"
      />
    </template>
    <!-- Empty state -->
    <div
      v-else
      class="tpl:flex tpl:min-h-[100px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-sm tpl:border-[var(--tpl-border-light)] tpl:bg-[var(--tpl-bg-hover)] tpl:text-[var(--tpl-text-dim)]"
    >
      <button
        v-if="canBrowse"
        :aria-label="t.image.browseMedia"
        class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:cursor-pointer tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-primary)] tpl:bg-[var(--tpl-bg)]"
        @click.stop="openMediaBrowser"
      >
        <Image :size="14" :stroke-width="1.5" />
        {{ t.image.browseMedia }}
      </button>
      <span v-else>{{ t.image.clickToAdd }}</span>
    </div>
  </div>
</template>
