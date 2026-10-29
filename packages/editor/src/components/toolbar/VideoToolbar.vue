<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
import MergeTagInput from "../MergeTagInput.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
} from "../../constants/styleConstants";
import type { VideoBlock } from "@templatical/types";
import { containsMergeTag, SYNTAX_PRESETS } from "@templatical/types";
import { Image } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { ON_REQUEST_MEDIA_KEY, MERGE_TAG_SYNTAX_KEY } from "../../keys";
import { useAliveFlag } from "../../composables/useAliveFlag";
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
const aliveFlag = useAliveFlag();

const WIDTH_PRESETS = [300, 400, 500];
const DEFAULT_CUSTOM_WIDTH = 350;
const DEFAULT_CUSTOM_HEIGHT = 200;

const canBrowseMedia = computed(() => !!onRequestMedia);
const urlHasMergeTag = computed(() =>
  containsMergeTag(props.block.url, mergeTagSyntax),
);

// Any other number reads as Custom: imports and agent-written JSON carry
// widths the presets don't list, and the select would otherwise show blank.
const widthMode = computed(() => {
  const w = props.block.width;
  if (w === "full") return "full";
  if (WIDTH_PRESETS.includes(w)) return String(w);
  return "custom";
});

const heightMode = computed(() =>
  typeof props.block.height === "number" ? "custom" : "auto",
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

function updateWidthMode(value: string): void {
  if (value === "custom") {
    const w = props.block.width;
    if (typeof w !== "number" || WIDTH_PRESETS.includes(w)) {
      updateField("width", DEFAULT_CUSTOM_WIDTH);
    }
    return;
  }
  updateField("width", value === "full" ? "full" : Number(value));
}

function updateCustomWidth(raw: string): void {
  // Same guard as the image block's custom width (#259): an empty number
  // field yields Number("") === 0, which would collapse the thumbnail.
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return;
  updateField("width", n);
}

function updateHeightMode(value: string): void {
  updateField("height", value === "custom" ? DEFAULT_CUSTOM_HEIGHT : undefined);
}

function updateCustomHeight(raw: string): void {
  // An empty number field yields Number("") === 0, which would collapse the
  // thumbnail. Absent means "keep the aspect ratio", so an invalid value must
  // not overwrite the last valid height either.
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return;
  updateField("height", n);
}

async function openMediaBrowser(): Promise<void> {
  const result = await onRequestMedia?.({ accept: ["images"] });
  if (!aliveFlag.alive) return;
  if (result) {
    updateField("thumbnailUrl", result.url);
    pulseThumbnail.value = true;
    startPulseThumbnail();
  }
}
</script>

<template>
  <FieldRow :label="t.video.videoUrl" class="tpl:mb-3.5" path="url">
    <MergeTagInput
      :model-value="block.url"
      type="url"
      :placeholder="t.video.videoUrlPlaceholder"
      @update:model-value="updateField('url', $event)"
    />
    <FieldRow v-if="block.url" path="openInNewTab" :label="t.video.openInNewTab"
      ><template #label-actions="{ controlId }"
        ><ToggleSwitch
          :control-id="controlId"
          hide-label
          class="tpl:mt-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
          :model-value="block.openInNewTab ?? false"
          :label="t.video.openInNewTab"
          @update:model-value="updateField('openInNewTab', $event)" /></template
    ></FieldRow>
  </FieldRow>
  <FieldRow v-if="urlHasMergeTag" class="tpl:mb-3.5" path="placeholderUrl">
    <template #label>
      {{ t.video.placeholderUrl }}
      <span class="tpl:font-normal tpl:text-[var(--tpl-text-dim)]">
        {{ t.video.optional }}
      </span>
    </template>
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
  </FieldRow>
  <FieldRow class="tpl:mb-3.5" path="thumbnailUrl">
    <template #label>
      {{ t.video.customThumbnail }}
      <span class="tpl:font-normal tpl:text-[var(--tpl-text-dim)]">
        {{ t.video.optional }}
      </span>
    </template>
    <MergeTagInput
      :model-value="block.thumbnailUrl"
      type="url"
      :placeholder="t.video.thumbnailPlaceholder"
      :pulse="pulseThumbnail"
      @update:model-value="updateField('thumbnailUrl', $event)"
    />
    <button
      v-if="canBrowseMedia"
      class="tpl:mt-2 tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all"
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
  </FieldRow>
  <FieldRow :label="t.video.altText" class="tpl:mb-3.5" path="alt">
    <MergeTagInput
      :model-value="block.alt"
      type="text"
      :placeholder="t.video.altTextPlaceholder"
      @update:model-value="updateField('alt', $event)"
    />
  </FieldRow>
  <FieldRow :label="t.video.width" class="tpl:mb-3.5" path="width">
    <select
      :class="inputClass"
      data-testid="video-width-mode"
      :value="widthMode"
      @change="updateWidthMode(($event.target as HTMLSelectElement).value)"
    >
      <option value="full">{{ t.video.fullWidth }}</option>
      <option value="300">300px</option>
      <option value="400">400px</option>
      <option value="500">500px</option>
      <option value="custom">{{ t.video.widthCustom }}</option>
    </select>
    <div
      v-if="widthMode === 'custom'"
      class="tpl:mt-2 tpl:flex tpl:items-stretch"
    >
      <input
        type="number"
        data-testid="video-width-input"
        :class="inputGroupInputClass"
        :value="block.width"
        min="20"
        @input="updateCustomWidth(($event.target as HTMLInputElement).value)"
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </FieldRow>
  <FieldRow :label="t.video.height" class="tpl:mb-3.5" path="height">
    <select
      :class="inputClass"
      data-testid="video-height-mode"
      :value="heightMode"
      @change="updateHeightMode(($event.target as HTMLSelectElement).value)"
    >
      <option value="auto">{{ t.video.heightAuto }}</option>
      <option value="custom">{{ t.video.heightCustom }}</option>
    </select>
    <div
      v-if="heightMode === 'custom'"
      class="tpl:mt-2 tpl:flex tpl:items-stretch"
    >
      <input
        type="number"
        data-testid="video-height-input"
        :class="inputGroupInputClass"
        :value="block.height"
        min="20"
        @input="updateCustomHeight(($event.target as HTMLInputElement).value)"
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </FieldRow>
  <FieldRow :label="t.title.align" class="tpl:mb-3.5" path="align">
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft },
        { value: 'center', label: t.title.alignCenter },
        { value: 'right', label: t.title.alignRight },
      ]"
      :model-value="block.align"
      @update:model-value="updateField('align', $event)"
    />
  </FieldRow>
</template>
