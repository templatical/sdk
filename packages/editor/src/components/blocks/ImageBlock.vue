<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { useMergeTag } from "../../composables/useMergeTag";
import type {
  ImageBlock as ImageBlockType,
  ViewportSize,
} from "@templatical/types";
import { containsMergeTag } from "@templatical/types";
import type { TemplaticalEditorConfig } from "../../index";
import { Image } from "@lucide/vue";
import { computed, inject } from "vue";

const props = defineProps<{
  block: ImageBlockType;
  viewport: ViewportSize;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ImageBlockType>): void;
}>();

const { t } = useI18n();
const { syntax } = useMergeTag();
const config = inject<TemplaticalEditorConfig>("config");
const canBrowseMedia = computed(() => !!config?.onRequestMedia);

async function browseMedia(): Promise<void> {
  const result = await config?.onRequestMedia?.({ accept: ["images"] });
  if (result) {
    const updates: Partial<ImageBlockType> = { src: result.url };
    if (result.alt) updates.alt = result.alt;
    emit("update", updates);
  }
}

const containerStyle = computed(() => ({
  textAlign: props.block.align,
}));

const imageStyle = computed(() => ({
  maxWidth: "100%",
  width: props.block.width === "full" ? "100%" : `${props.block.width}px`,
  display: "block",
  margin: props.block.align === "center" ? "0 auto" : undefined,
  marginLeft: props.block.align === "right" ? "auto" : undefined,
}));

const hasMergeTagSrc = computed(() =>
  containsMergeTag(props.block.src, syntax),
);
</script>

<template>
  <div class="tpl:w-full" :style="containerStyle">
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
      class="tpl:!flex tpl:min-h-[120px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-center"
      style="
        background-color: var(--tpl-bg-elevated);
        border-color: color-mix(in srgb, var(--tpl-primary) 40%, transparent);
      "
      :style="imageStyle"
    >
      <Image
        :size="32"
        :stroke-width="1.5"
        style="color: var(--tpl-primary); opacity: 0.5"
      />
      <span
        class="tpl:max-w-full tpl:truncate tpl:px-3 tpl:text-xs tpl:font-medium"
        style="color: var(--tpl-primary); opacity: 0.7"
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
      class="tpl:flex tpl:min-h-[100px] tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2 tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-sm"
      style="
        border-color: var(--tpl-border-light);
        background-color: var(--tpl-bg-hover);
        color: var(--tpl-text-dim);
      "
    >
      <button
        v-if="canBrowseMedia"
        :aria-label="t.image.browseMedia"
        class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150 tpl:cursor-pointer"
        style="
          border-color: var(--tpl-border);
          color: var(--tpl-primary);
          background-color: var(--tpl-bg);
        "
        @click.stop="browseMedia"
      >
        <Image :size="14" :stroke-width="1.5" />
        {{ t.image.browseMedia }}
      </button>
      <span v-else>{{ t.image.clickToAdd }}</span>
    </div>
  </div>
</template>
