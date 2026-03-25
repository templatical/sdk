<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { useMergeTag } from "../../composables/useMergeTag";
import type {
  ImageBlock as ImageBlockType,
  ViewportSize,
} from "@templatical/types";
import { containsMergeTag } from "@templatical/types";
import { Image } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  block: ImageBlockType;
  viewport: ViewportSize;
}>();

const { t } = useI18n();
const { syntax } = useMergeTag();

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
    <template v-if="block.src && hasMergeTagSrc && block.previewUrl">
      <a
        v-if="block.linkUrl"
        :href="block.linkUrl"
        target="_blank"
        rel="noopener noreferrer"
        @click.prevent
      >
        <img
          class="tpl:border-0"
          :src="block.previewUrl"
          :alt="block.alt"
          :style="imageStyle"
        />
      </a>
      <img
        v-else
        class="tpl:border-0"
        :src="block.previewUrl"
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
          :src="block.src"
          :alt="block.alt"
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
      class="tpl:flex tpl:min-h-[100px] tpl:items-center tpl:justify-center tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-sm"
      style="
        border-color: var(--tpl-border-light);
        background-color: var(--tpl-bg-hover);
        color: var(--tpl-text-dim);
      "
    >
      <span>{{ t.image.clickToAdd }}</span>
    </div>
  </div>
</template>
