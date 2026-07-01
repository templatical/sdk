<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { useMergeTag } from "../../composables/useMergeTag";
import type {
  ImageBlock as ImageBlockType,
  ViewportSize,
} from "@templatical/types";
import { containsMergeTag } from "@templatical/types";
import { Image, Upload, LoaderCircle } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { ON_REQUEST_MEDIA_KEY } from "../../keys";
import { useAliveFlag } from "../../composables/useAliveFlag";
import { useImageDrop } from "../../composables/useImageDrop";

const props = defineProps<{
  block: ImageBlockType;
  viewport: ViewportSize;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ImageBlockType>): void;
}>();

const { t } = useI18n();
const { syntax } = useMergeTag();
const onRequestMedia = inject(ON_REQUEST_MEDIA_KEY, null);
const canBrowseMedia = computed(() => !!onRequestMedia);
const aliveFlag = useAliveFlag();

async function browseMedia(): Promise<void> {
  const result = await onRequestMedia?.({ accept: ["images"] });
  if (!aliveFlag.alive) return;
  if (result) {
    const updates: Partial<ImageBlockType> = { src: result.url };
    if (result.alt) updates.alt = result.alt;
    emit("update", updates);
  }
}

// --- Drag-and-drop upload (#229) ---
const dropZoneRef = ref<HTMLElement>();
const isUploading = ref(false);

// A merge-tag src is a deliberate dynamic value — never clobber it via drop.
const dropEnabled = computed(
  () => canBrowseMedia.value && !isUploading.value && !hasMergeTagSrc.value,
);

async function uploadDroppedFiles(files: File[]): Promise<void> {
  if (!onRequestMedia) return;
  isUploading.value = true;
  try {
    const result = await onRequestMedia({ accept: ["images"], files });
    if (!aliveFlag.alive) return;
    if (result) {
      const updates: Partial<ImageBlockType> = { src: result.url };
      if (result.alt) updates.alt = result.alt;
      emit("update", updates);
    }
  } finally {
    if (aliveFlag.alive) isUploading.value = false;
  }
}

const { isOver } = useImageDrop({
  target: dropZoneRef,
  enabled: dropEnabled,
  onFiles: uploadDroppedFiles,
});

const containerStyle = computed(() => ({
  textAlign: props.block.align,
}));

const imageStyle = computed(() => {
  const align = props.block.align;
  return {
    maxWidth: "100%",
    width: props.block.width === "full" ? "100%" : `${props.block.width}px`,
    display: "block",
    marginLeft: align === "center" || align === "right" ? "auto" : undefined,
    marginRight: align === "center" ? "auto" : undefined,
  };
});

const hasMergeTagSrc = computed(() =>
  containsMergeTag(props.block.src, syntax),
);
</script>

<template>
  <div
    ref="dropZoneRef"
    data-testid="image-drop-zone"
    class="tpl:relative tpl:w-full"
    :style="containerStyle"
  >
    <!-- Drag-over / uploading overlay (#229) -->
    <div
      v-if="dropEnabled && (isOver || isUploading)"
      class="tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-10 tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-xs tpl:font-medium tpl:border-[var(--tpl-primary)] tpl:text-[var(--tpl-primary)]"
      style="
        background-color: color-mix(in srgb, var(--tpl-bg) 85%, transparent);
      "
    >
      <template v-if="isUploading">
        <LoaderCircle class="tpl-spinner" :size="20" :stroke-width="2" />
        {{ t.image.uploading }}
      </template>
      <template v-else>
        <Upload :size="20" :stroke-width="1.5" />
        {{ t.image.dropToUpload }}
      </template>
    </div>
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
          :src="block.placeholderUrl"
          :alt="block.alt || t.image.altTextPlaceholder"
          :style="imageStyle"
        />
      </a>
      <img
        v-else
        class="tpl:border-0"
        :src="block.placeholderUrl"
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
        {{ block.src }}
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
          :src="block.src"
          :alt="block.alt || t.image.altTextPlaceholder"
          :style="imageStyle"
        />
      </a>
      <img
        v-else
        class="tpl:border-0"
        :src="block.src"
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
        v-if="canBrowseMedia"
        :aria-label="t.image.browseMedia"
        class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150 tpl:cursor-pointer tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-primary)] tpl:bg-[var(--tpl-bg)]"
        @click.stop="browseMedia"
      >
        <Image :size="14" :stroke-width="1.5" />
        {{ t.image.browseMedia }}
      </button>
      <span v-else>{{ t.image.clickToAdd }}</span>
    </div>
  </div>
</template>
