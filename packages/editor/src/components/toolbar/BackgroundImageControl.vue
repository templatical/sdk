<script setup lang="ts">
import MediaDropOverlay from "../MediaDropOverlay.vue";
import MergeTagInput from "../MergeTagInput.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import { useI18n } from "../../composables/useI18n";
import { labelClass } from "../../constants/styleConstants";
import {
  BACKGROUND_POSITIONS_X,
  BACKGROUND_POSITIONS_Y,
  containsMergeTag,
  createBackgroundImage,
  SYNTAX_PRESETS,
  type BackgroundImage,
  type BackgroundPositionX,
  type BackgroundPositionY,
  type BackgroundSize,
} from "@templatical/types";
import { Image } from "@lucide/vue";
import { computed, inject, onScopeDispose, ref } from "vue";
import { MERGE_TAG_SYNTAX_KEY } from "../../keys";
import { RESOLVE_IMAGE_DEBOUNCE_MS } from "../../constants/timeouts";
import { useImageMeasure } from "../../composables/useImageMeasure";
import { useMediaDropField } from "../../composables/useMediaDropField";

const props = defineProps<{
  modelValue: BackgroundImage | undefined;
  testidPrefix: string;
  /**
   * Measure the natural size of an image the author sets and store it on the
   * image: a section's image, whose shape a hero can match.
   */
  measure?: boolean;
  /**
   * The section renders as a hero, which always paints its image `cover`,
   * unrepeated: size and repeat are hidden, and keep their values.
   */
  heroMode?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: BackgroundImage | undefined): void;
}>();

const { t } = useI18n();
const mergeTagSyntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);

// Loaded JSON isn't schema-checked, so a non-string url reads as empty.
const url = computed(() =>
  typeof props.modelValue?.url === "string" ? props.modelValue.url : "",
);
const hasImage = computed(() => url.value.trim() !== "");

const measureImageSize = useImageMeasure();
let measureTimer: ReturnType<typeof setTimeout> | undefined;
onScopeDispose(() => clearTimeout(measureTimer));

/**
 * Measure `url` once typing settles. A result for a url the author has since
 * replaced is dropped.
 */
function scheduleMeasure(url: string): void {
  clearTimeout(measureTimer);
  if (!props.measure || containsMergeTag(url, mergeTagSyntax)) return;
  measureTimer = setTimeout(async () => {
    const size = await measureImageSize(url);
    const current = props.modelValue;
    if (!size || current?.url !== url) return;
    emit("update:modelValue", {
      ...current,
      naturalWidth: size.width,
      naturalHeight: size.height,
    });
  }, RESOLVE_IMAGE_DEBOUNCE_MS);
}

/**
 * A blank url removes the image; the first url creates one with defaults. A
 * new url's size is unknown until it is measured, so the previous image's
 * never carries over.
 */
function setUrl(value: string): void {
  if (value.trim() === "") {
    emit("update:modelValue", undefined);
    return;
  }
  if (props.modelValue) {
    const { naturalWidth, naturalHeight, ...image } = props.modelValue;
    emit("update:modelValue", { ...image, url: value });
  } else {
    emit("update:modelValue", createBackgroundImage(value));
  }
  scheduleMeasure(value);
}

function patch(update: Partial<Omit<BackgroundImage, "url">>): void {
  if (!props.modelValue) return;
  emit("update:modelValue", { ...props.modelValue, ...update });
}

const sizeOptions = computed(() => [
  { value: "cover", label: t.blockSettings.backgroundSizeCover },
  { value: "contain", label: t.blockSettings.backgroundSizeContain },
  { value: "auto", label: t.blockSettings.backgroundSizeAuto },
]);

interface PositionCell {
  x: BackgroundPositionX;
  y: BackgroundPositionY;
  label: string;
}

// Spelled out key by key: `i18n-key-usage.test.ts` treats an indexed read
// (`t.blockSettings[key]`) as a reference to the whole subtree, which would
// stop it noticing dead `blockSettings` keys.
const positionLabels = computed<
  Record<`${BackgroundPositionY}-${BackgroundPositionX}`, string>
>(() => ({
  "top-left": t.blockSettings.backgroundPositionTopLeft,
  "top-center": t.blockSettings.backgroundPositionTopCenter,
  "top-right": t.blockSettings.backgroundPositionTopRight,
  "center-left": t.blockSettings.backgroundPositionCenterLeft,
  "center-center": t.blockSettings.backgroundPositionCenter,
  "center-right": t.blockSettings.backgroundPositionCenterRight,
  "bottom-left": t.blockSettings.backgroundPositionBottomLeft,
  "bottom-center": t.blockSettings.backgroundPositionBottomCenter,
  "bottom-right": t.blockSettings.backgroundPositionBottomRight,
}));

const positionCells = computed<PositionCell[]>(() =>
  BACKGROUND_POSITIONS_Y.flatMap((y) =>
    BACKGROUND_POSITIONS_X.map((x) => ({
      x,
      y,
      label: positionLabels.value[`${y}-${x}`],
    })),
  ),
);

function isCurrentPosition(cell: PositionCell): boolean {
  return (
    props.modelValue?.position?.x === cell.x &&
    props.modelValue?.position?.y === cell.y
  );
}

const dropZoneRef = ref<HTMLElement>();
const { canBrowse, isUploading, showOverlay, openMediaBrowser } =
  useMediaDropField({
    target: dropZoneRef,
    // A merge-tag url is a deliberate dynamic value — never clobber it via drop.
    blocked: () => containsMergeTag(url.value, mergeTagSyntax),
    apply: (result) => setUrl(result.url),
  });
</script>

<template>
  <div class="tpl:space-y-3.5">
    <div>
      <label :class="labelClass">{{ t.blockSettings.backgroundImage }}</label>
      <div
        ref="dropZoneRef"
        class="tpl:relative"
        :data-testid="`${testidPrefix}-bg-url`"
      >
        <MediaDropOverlay v-if="showOverlay" :uploading="isUploading" />
        <MergeTagInput
          :model-value="url"
          type="url"
          :placeholder="t.blockSettings.backgroundImagePlaceholder"
          @update:model-value="setUrl"
        />
        <button
          v-if="canBrowse"
          type="button"
          :data-testid="`${testidPrefix}-bg-browse`"
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

    <template v-if="hasImage && modelValue">
      <div v-if="!heroMode" :data-testid="`${testidPrefix}-bg-size`">
        <label :class="labelClass">{{ t.blockSettings.backgroundSize }}</label>
        <SlidingPillSelect
          :options="sizeOptions"
          :model-value="modelValue.size"
          @update:model-value="patch({ size: $event as BackgroundSize })"
        />
      </div>

      <div>
        <label :class="labelClass">{{
          t.blockSettings.backgroundPosition
        }}</label>
        <div
          role="group"
          :aria-label="t.blockSettings.backgroundPosition"
          :data-testid="`${testidPrefix}-bg-position`"
          class="tpl:grid tpl:w-24 tpl:grid-cols-3 tpl:gap-1"
        >
          <button
            v-for="cell in positionCells"
            :key="`${cell.y}-${cell.x}`"
            type="button"
            :aria-label="cell.label"
            :title="cell.label"
            :aria-pressed="isCurrentPosition(cell)"
            :data-testid="`${testidPrefix}-bg-position-${cell.y}-${cell.x}`"
            class="tpl:flex tpl:h-6 tpl:items-center tpl:justify-center tpl:rounded tpl:border tpl:transition-colors"
            :class="
              isCurrentPosition(cell)
                ? 'tpl:border-[var(--tpl-primary)]'
                : 'tpl:border-[var(--tpl-border)] tpl:hover:border-[var(--tpl-text-dim)]'
            "
            @click="patch({ position: { x: cell.x, y: cell.y } })"
          >
            <span
              class="tpl:block tpl:h-1.5 tpl:w-1.5 tpl:rounded-full"
              :class="
                isCurrentPosition(cell)
                  ? 'tpl:bg-[var(--tpl-primary)]'
                  : 'tpl:bg-[var(--tpl-text-dim)]'
              "
            />
          </button>
        </div>
      </div>

      <div v-if="!heroMode" :data-testid="`${testidPrefix}-bg-repeat`">
        <ToggleSwitch
          class="tpl:text-xs tpl:text-[var(--tpl-text)]"
          :model-value="modelValue.repeat"
          :label="t.blockSettings.backgroundRepeat"
          @update:model-value="patch({ repeat: $event })"
        />
      </div>
    </template>
  </div>
</template>
