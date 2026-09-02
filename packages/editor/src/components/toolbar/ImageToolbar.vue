<script setup lang="ts">
import MergeTagInput from "../MergeTagInput.vue";
import NumberWithSuffix from "./NumberWithSuffix.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../../constants/styleConstants";
import type { ImageBlock } from "@templatical/types";
import { containsMergeTag, SYNTAX_PRESETS } from "@templatical/types";
import { Image, Upload, LoaderCircle } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { ON_REQUEST_MEDIA_KEY, MERGE_TAG_SYNTAX_KEY } from "../../keys";
import { useAliveFlag } from "../../composables/useAliveFlag";
import { useImageDrop } from "../../composables/useImageDrop";
import { useTimeoutFn } from "@vueuse/core";

const props = defineProps<{
  block: ImageBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<ImageBlock>): void;
}>();

const { t } = useI18n();
const onRequestMedia = inject(ON_REQUEST_MEDIA_KEY, null);
const mergeTagSyntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
const aliveFlag = useAliveFlag();

const canBrowseMedia = computed(() => !!onRequestMedia);

const pulseSrc = ref(false);
const pulseAlt = ref(false);

const { start: startPulseSrc } = useTimeoutFn(
  () => {
    pulseSrc.value = false;
  },
  1000,
  { immediate: false },
);

const WIDTH_PRESETS = [300, 400, 500];
const DEFAULT_CUSTOM_WIDTH = 350;
const DEFAULT_CUSTOM_HEIGHT = 200;

const widthMode = computed(() => {
  const w = props.block.width;
  if (w === "full") return "full";
  if (WIDTH_PRESETS.includes(w)) return String(w);
  return "custom";
});

const heightMode = computed(() =>
  typeof props.block.height === "number" ? "custom" : "auto",
);

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<ImageBlock>);
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

function updateHeightMode(value: string): void {
  updateField("height", value === "custom" ? DEFAULT_CUSTOM_HEIGHT : undefined);
}

function updateCustomHeight(raw: string): void {
  // Same guard as the custom width below: an empty number field yields
  // Number("") === 0, which would collapse the image to nothing. Absent means
  // "keep the aspect ratio", so an invalid value must not overwrite the last
  // valid height either.
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return;
  updateField("height", n);
}

function updateBorderRadius(value: number): void {
  // Negatives only, where the width and height guards below also reject 0:
  // here 0 is a real answer (square), so an emptied field clears the radius
  // rather than keeping the old one. `NumberWithSuffix` withholds the
  // in-progress "-" that would otherwise arrive here as a 0.
  if (!Number.isFinite(value) || value < 0) return;
  // Absent, not 0: both render as square corners, but a stored 0 travels in
  // every exported template as though the author had chosen it. Matches
  // `createImageBlock`, and `updateHeightMode` above clears the same way.
  updateField("borderRadius", value > 0 ? value : undefined);
}

function updateCustomWidth(raw: string): void {
  // Guard against empty / NaN / non-positive input. An empty number field
  // yields Number("") === 0, which would emit width: 0 and render an
  // invisible image (#259). Ignore invalid values and keep the last valid
  // width; the canvas still updates live on each valid keystroke.
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return;
  updateField("width", n);
}

async function openMediaBrowser(): Promise<void> {
  const result = await onRequestMedia?.({ accept: ["images"] });
  if (!aliveFlag.alive) return;
  if (result) {
    updateField("src", result.url);
    if (result.alt) {
      updateField("alt", result.alt);
      pulseAlt.value = true;
    }
    pulseSrc.value = true;
    startPulseSrc();
  }
}

// --- Drag-and-drop upload (#229) ---
const dropZoneRef = ref<HTMLElement>();
const isUploading = ref(false);
// A merge-tag src is a deliberate dynamic value — never clobber it via drop.
const hasMergeTagSrc = computed(() =>
  containsMergeTag(props.block.src, mergeTagSyntax),
);
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
      updateField("src", result.url);
      if (result.alt) {
        updateField("alt", result.alt);
        pulseAlt.value = true;
      }
      pulseSrc.value = true;
      startPulseSrc();
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
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.imageUrl }}</label>
    <div ref="dropZoneRef" class="tpl:relative">
      <!-- Drag-over / uploading overlay (#229) -->
      <div
        v-if="dropEnabled && (isOver || isUploading)"
        class="tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-10 tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-xs tpl:font-medium tpl:border-[var(--tpl-primary)] tpl:text-[var(--tpl-primary)]"
        style="
          background-color: color-mix(in srgb, var(--tpl-bg) 90%, transparent);
        "
      >
        <template v-if="isUploading">
          <LoaderCircle class="tpl-spinner" :size="18" :stroke-width="2" />
          {{ t.image.uploading }}
        </template>
        <template v-else>
          <Upload :size="18" :stroke-width="1.5" />
          {{ t.image.dropToUpload }}
        </template>
      </div>
      <MergeTagInput
        :model-value="block.src"
        type="url"
        :placeholder="t.image.imageUrlPlaceholder"
        :pulse="pulseSrc"
        @update:model-value="updateField('src', $event)"
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
    </div>
  </div>
  <div v-if="containsMergeTag(block.src, mergeTagSyntax)" class="tpl:mb-3.5">
    <label :class="labelClass"
      >{{ t.image.placeholderUrl }}
      <span class="tpl:font-normal tpl:text-[var(--tpl-text-dim)]">
        {{ t.image.optional }}
      </span>
    </label>
    <input
      type="url"
      :class="inputClass"
      :value="block.placeholderUrl || ''"
      :placeholder="t.image.placeholderUrlPlaceholder"
      :title="t.image.placeholderUrlTooltip"
      @input="
        updateField('placeholderUrl', ($event.target as HTMLInputElement).value)
      "
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.altText }}</label>
    <MergeTagInput
      :model-value="block.alt"
      type="text"
      :placeholder="t.image.altTextPlaceholder"
      :pulse="pulseAlt"
      :disabled="block.decorative === true"
      @update:model-value="updateField('alt', $event)"
    />
    <ToggleSwitch
      class="tpl:mt-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
      :model-value="block.decorative === true"
      :label="t.image.decorative"
      @update:model-value="updateField('decorative', $event)"
    >
      <span>
        {{ t.image.decorative }}
        <span class="tpl:block tpl:text-[var(--tpl-text-dim)]">
          {{ t.image.decorativeHint }}
        </span>
      </span>
    </ToggleSwitch>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.width }}</label>
    <select
      :class="inputClass"
      :value="widthMode"
      @change="updateWidthMode(($event.target as HTMLSelectElement).value)"
    >
      <option value="full">{{ t.image.fullWidth }}</option>
      <option value="300">300px</option>
      <option value="400">400px</option>
      <option value="500">500px</option>
      <option value="custom">{{ t.image.widthCustom }}</option>
    </select>
    <div
      v-if="widthMode === 'custom'"
      class="tpl:mt-2 tpl:flex tpl:items-stretch"
    >
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="
          typeof block.width === 'number' ? block.width : DEFAULT_CUSTOM_WIDTH
        "
        min="20"
        @input="updateCustomWidth(($event.target as HTMLInputElement).value)"
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.height }}</label>
    <select
      :class="inputClass"
      data-testid="image-height-mode"
      :value="heightMode"
      @change="updateHeightMode(($event.target as HTMLSelectElement).value)"
    >
      <option value="auto">{{ t.image.heightAuto }}</option>
      <option value="custom">{{ t.image.heightCustom }}</option>
    </select>
    <div
      v-if="heightMode === 'custom'"
      class="tpl:mt-2 tpl:flex tpl:items-stretch"
    >
      <input
        type="number"
        data-testid="image-height-input"
        :class="inputGroupInputClass"
        :value="block.height"
        min="20"
        @input="updateCustomHeight(($event.target as HTMLInputElement).value)"
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.borderRadius }}</label>
    <!-- No `max`: a circle needs a radius of at least half the rendered size,
         which the block cannot know at edit time. -->
    <NumberWithSuffix
      :model-value="block.borderRadius ?? 0"
      :min="0"
      suffix="px"
      testid="image-border-radius-input"
      @update:model-value="updateBorderRadius"
    />
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
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.image.linkUrl }}</label>
    <MergeTagInput
      :model-value="block.linkUrl || ''"
      type="url"
      :placeholder="t.image.imageUrlPlaceholder"
      @update:model-value="updateField('linkUrl', $event)"
    />
    <ToggleSwitch
      v-if="block.linkUrl"
      class="tpl:mt-2 tpl:text-[12px] tpl:text-[var(--tpl-text-muted)]"
      :model-value="block.linkOpenInNewTab ?? false"
      :label="t.image.openInNewTab"
      @update:model-value="updateField('linkOpenInNewTab', $event)"
    />
  </div>
</template>
