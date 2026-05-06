<script setup lang="ts">
import MergeTagInput from "../MergeTagInput.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import { inputClass, labelClass } from "../../constants/styleConstants";
import type { VideoBlock } from "@templatical/types";
import { containsMergeTag, SYNTAX_PRESETS } from "@templatical/types";
import { Image } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { ON_REQUEST_MEDIA_KEY, MERGE_TAG_SYNTAX_KEY } from "../../keys";
import { useTimeoutFn } from "@vueuse/core";

const props = defineProps<{
  block: VideoBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<VideoBlock>): void;
}>();

const { t } = useI18n();
const onRequestMedia = inject(ON_REQUEST_MEDIA_KEY, null);
const mergeTagSyntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);

const canBrowseMedia = computed(() => !!onRequestMedia);
const urlHasMergeTag = computed(() =>
  containsMergeTag(props.block.url, mergeTagSyntax),
);

const pulseThumbnail = ref(false);
const { start: startPulseThumbnail } = useTimeoutFn(
  () => {
    pulseThumbnail.value = false;
  },
  1000,
  { immediate: false },
);

function updateField(field: keyof VideoBlock, value: unknown): void {
  emit("update", { [field]: value } as Partial<VideoBlock>);
}

async function openMediaBrowser(): Promise<void> {
  const result = await onRequestMedia?.({ accept: ["images"] });
  if (result) {
    updateField("thumbnailUrl", result.url);
    pulseThumbnail.value = true;
    startPulseThumbnail();
  }
}
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.video.videoUrl }}</label>
    <MergeTagInput
      :model-value="block.url"
      type="url"
      :placeholder="t.video.videoUrlPlaceholder"
      @update:model-value="updateField('url', $event)"
    />
    <label
      v-if="block.url"
      class="tpl:mt-2 tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
    >
      <input
        type="checkbox"
        class="tpl:size-3.5 tpl:cursor-pointer tpl:accent-[var(--tpl-primary)]"
        :checked="block.openInNewTab ?? false"
        @change="
          updateField(
            'openInNewTab',
            ($event.target as HTMLInputElement).checked,
          )
        "
      />
      {{ t.video.openInNewTab }}
    </label>
  </div>
  <div v-if="urlHasMergeTag" class="tpl:mb-3.5">
    <label :class="labelClass">
      {{ t.video.placeholderUrl }}
      <span class="tpl:font-normal tpl:text-[var(--tpl-text-dim)]">
        {{ t.video.optional }}
      </span>
    </label>
    <input
      type="url"
      :class="inputClass"
      :value="block.placeholderUrl || ''"
      :placeholder="t.video.placeholderUrlPlaceholder"
      :title="t.video.placeholderUrlTooltip"
      @input="
        updateField('placeholderUrl', ($event.target as HTMLInputElement).value)
      "
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">
      {{ t.video.customThumbnail }}
      <span class="tpl:font-normal tpl:text-[var(--tpl-text-dim)]">
        {{ t.video.optional }}
      </span>
    </label>
    <MergeTagInput
      :model-value="block.thumbnailUrl"
      type="url"
      :placeholder="t.video.thumbnailPlaceholder"
      :pulse="pulseThumbnail"
      @update:model-value="updateField('thumbnailUrl', $event)"
    />
    <button
      v-if="canBrowseMedia"
      class="tpl:mt-2 tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
      style="
        border-color: var(--tpl-border);
        color: var(--tpl-primary);
        background-color: var(--tpl-bg);
      "
      @click="openMediaBrowser"
    >
      <Image :size="14" :stroke-width="1.5" />
      {{ t.image.browseMedia }}
    </button>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.video.altText }}</label>
    <MergeTagInput
      :model-value="block.alt"
      type="text"
      :placeholder="t.video.altTextPlaceholder"
      @update:model-value="updateField('alt', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.video.width }}</label>
    <select
      :class="inputClass"
      :value="block.width"
      @change="
        updateField(
          'width',
          ($event.target as HTMLSelectElement).value === 'full'
            ? 'full'
            : Number(($event.target as HTMLSelectElement).value),
        )
      "
    >
      <option value="full">{{ t.video.fullWidth }}</option>
      <option value="300">300px</option>
      <option value="400">400px</option>
      <option value="500">500px</option>
    </select>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.title.align }}</label>
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft },
        { value: 'center', label: t.title.alignCenter },
        { value: 'right', label: t.title.alignRight },
      ]"
      :model-value="block.align"
      @update:model-value="updateField('align', $event)"
    />
  </div>
</template>
