<script setup lang="ts">
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
import { Image, LoaderCircle, Upload } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import {
  CAN_DROP_MEDIA_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MEDIA_KEY,
} from "../../keys";
import { useAliveFlag } from "../../composables/useAliveFlag";
import { useImageDrop } from "../../composables/useImageDrop";

const props = defineProps<{
  modelValue: BackgroundImage | undefined;
  testidPrefix: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: BackgroundImage | undefined): void;
}>();

const { t } = useI18n();
const onRequestMedia = inject(ON_REQUEST_MEDIA_KEY, null);
const canDropMedia = inject(CAN_DROP_MEDIA_KEY, null);
const mergeTagSyntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
const aliveFlag = useAliveFlag();

// Loaded JSON isn't schema-checked, so a non-string url reads as empty.
const url = computed(() =>
  typeof props.modelValue?.url === "string" ? props.modelValue.url : "",
);
const hasImage = computed(() => url.value.trim() !== "");

/** A blank url removes the image; the first url creates one with defaults. */
function setUrl(value: string): void {
  if (value.trim() === "") {
    emit("update:modelValue", undefined);
    return;
  }
  emit(
    "update:modelValue",
    props.modelValue
      ? { ...props.modelValue, url: value }
      : createBackgroundImage(value),
  );
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

async function openMediaBrowser(): Promise<void> {
  const result = await onRequestMedia?.({ accept: ["images"] });
  if (!aliveFlag.alive) return;
  if (result) setUrl(result.url);
}

// A merge-tag url is a deliberate dynamic value — never clobber it via drop.
const dropZoneRef = ref<HTMLElement>();
const isUploading = ref(false);
const dropEnabled = computed(
  () =>
    (canDropMedia?.value ?? !!onRequestMedia) &&
    !isUploading.value &&
    !containsMergeTag(url.value, mergeTagSyntax),
);

async function uploadDroppedFiles(files: File[]): Promise<void> {
  if (!onRequestMedia) return;
  isUploading.value = true;
  try {
    const result = await onRequestMedia({ accept: ["images"], files });
    if (!aliveFlag.alive) return;
    if (result) setUrl(result.url);
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
  <div class="tpl:space-y-3.5">
    <div>
      <label :class="labelClass">{{ t.blockSettings.backgroundImage }}</label>
      <div
        ref="dropZoneRef"
        class="tpl:relative"
        :data-testid="`${testidPrefix}-bg-url`"
      >
        <div
          v-if="(dropEnabled && isOver) || isUploading"
          class="tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-10 tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded tpl:border-2 tpl:border-dashed tpl:text-xs tpl:font-medium tpl:border-[var(--tpl-primary)] tpl:text-[var(--tpl-primary)]"
          style="
            background-color: color-mix(
              in srgb,
              var(--tpl-bg) 90%,
              transparent
            );
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
          :model-value="url"
          type="url"
          :placeholder="t.blockSettings.backgroundImagePlaceholder"
          @update:model-value="setUrl"
        />
        <button
          v-if="onRequestMedia"
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
      <div :data-testid="`${testidPrefix}-bg-size`">
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

      <div :data-testid="`${testidPrefix}-bg-repeat`">
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
