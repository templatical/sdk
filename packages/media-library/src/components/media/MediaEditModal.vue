<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { useMediaCategories } from "../../composables/useMediaCategories";
import {
  ASPECT_RATIO_VALUES,
  calculateOutputDimensions,
  canvasToFile,
  getExportSettings,
  resizeCanvas,
  type AspectRatioPreset,
} from "../../composables/useImageCrop";
import { POPOVER_TARGET_KEY, UI_THEME_KEY } from "../../keys";
import type { MediaAsset } from "@templatical/types";
import { useFocusTrap } from "../../composables/useFocusTrap";
import { computed, inject, ref, watch } from "vue";
import { Cropper, type CropperResult } from "vue-advanced-cropper";
import "vue-advanced-cropper/dist/style.css";

export interface CropData {
  file: File;
}

/**
 * `"replaced"`: the cropped file landed but the metadata update failed. The
 * dialog stays open either way short of `"saved"`.
 */
export type MediaEditSaveResult = "saved" | "replaced" | "failed";

export type MediaEditSave = (
  id: string,
  filename: string,
  altText?: string,
  cropData?: CropData,
) => Promise<MediaEditSaveResult>;

const props = defineProps<{
  visible: boolean;
  item: MediaAsset | null;
  save: MediaEditSave;
  /** The provider can `replace` this asset, so a crop has somewhere to go. */
  canCrop?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { t } = useI18n();
const tplUiTheme = inject(UI_THEME_KEY, null);
const popoverTarget = inject(POPOVER_TARGET_KEY, ref<HTMLElement | null>(null));
const mediaT = t.mediaLibrary as Record<string, string>;

const { isImageMimeType } = useMediaCategories();

const filenameValue = ref("");
const altTextValue = ref("");

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null);
const aspectRatio = ref<AspectRatioPreset>("free");
const maxWidth = ref<number | undefined>(undefined);
const maxHeight = ref<number | undefined>(undefined);
const maxWidthInput = ref("");
const maxHeightInput = ref("");
const originalAspectRatio = ref<number | undefined>(undefined);
const cropCoordinates = ref<{ width: number; height: number } | null>(null);
const imageLoaded = ref(false);
const isSaving = ref(false);
const hasModifiedCrop = ref(false);
const saveError = ref<"save" | "crop" | null>(null);

interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The cropper emits `change` once on load with its default box. That event is
// the baseline, not an edit: treated as one, every alt-text save re-encoded
// and replaced the image.
let baselineCoordinates: CropBox | null = null;

// GIF is excluded: the canvas export holds one frame, so a crop would save a
// still image in place of an animation.
const CROPPABLE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const isCroppableImage = computed(() => {
  if (!props.item || !props.canCrop) {
    return false;
  }

  return CROPPABLE_MIME_TYPES.includes(props.item.mimeType ?? "");
});

const hasResize = computed(
  () => maxWidth.value !== undefined || maxHeight.value !== undefined,
);

const aspectRatioValue = computed(() => {
  if (aspectRatio.value === "original") {
    return originalAspectRatio.value;
  }

  return ASPECT_RATIO_VALUES[aspectRatio.value];
});

const outputDimensions = computed(() => {
  if (!cropCoordinates.value) {
    return null;
  }

  return calculateOutputDimensions(
    cropCoordinates.value.width,
    cropCoordinates.value.height,
    maxWidth.value,
    maxHeight.value,
  );
});

watch(
  () => props.visible,
  (visible) => {
    if (visible && props.item) {
      filenameValue.value = props.item.filename ?? "";
      altTextValue.value = props.item.alt ?? "";
      aspectRatio.value = "free";
      maxWidth.value = undefined;
      maxHeight.value = undefined;
      maxWidthInput.value = "";
      maxHeightInput.value = "";
      originalAspectRatio.value = undefined;
      cropCoordinates.value = null;
      imageLoaded.value = false;
      hasModifiedCrop.value = false;
      saveError.value = null;
      baselineCoordinates = null;

      if (props.item.width && props.item.height) {
        originalAspectRatio.value = props.item.width / props.item.height;
      }
    }
  },
  // Chrome mounts this behind `v-if="editingItem"` with `:visible="true"`, so
  // the first open never sees a false→true transition.
  { immediate: true },
);

function roundBox(box: CropBox): CropBox {
  return {
    left: Math.round(box.left),
    top: Math.round(box.top),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

function sameBox(a: CropBox, b: CropBox): boolean {
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
}

function handleCropChange(result: CropperResult): void {
  if (!result.coordinates) {
    return;
  }
  const box = roundBox(result.coordinates);
  cropCoordinates.value = { width: box.width, height: box.height };

  if (!baselineCoordinates) {
    baselineCoordinates = box;
    return;
  }
  // Compared rather than latched: a box dragged back to where it started, or
  // a preset whose box is the whole image (Original), is no crop.
  hasModifiedCrop.value = !sameBox(box, baselineCoordinates);
}

// The default box is the whole image, so an untouched cropper's result is the
// original and a resize without a crop scales the full image.
function fullImageSize({
  imageSize,
}: {
  imageSize: { width: number; height: number };
}): { width: number; height: number } {
  return { width: imageSize.width, height: imageSize.height };
}

function handleImageReady(): void {
  imageLoaded.value = true;

  if (!originalAspectRatio.value && props.item?.width && props.item?.height) {
    originalAspectRatio.value = props.item.width / props.item.height;
  }
}

function handleMaxWidthInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  maxWidthInput.value = value;
  maxWidth.value = value ? parseInt(value, 10) || undefined : undefined;
}

function handleMaxHeightInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  maxHeightInput.value = value;
  maxHeight.value = value ? parseInt(value, 10) || undefined : undefined;
}

async function handleSave(): Promise<void> {
  const trimmedFilename = filenameValue.value.trim();
  if (!trimmedFilename || !props.item || isSaving.value) {
    return;
  }

  const item = props.item;
  const isImage = isImageMimeType(item.mimeType ?? "");
  let cropData: CropData | undefined;

  isSaving.value = true;
  saveError.value = null;

  if (
    isCroppableImage.value &&
    cropperRef.value &&
    (hasModifiedCrop.value || hasResize.value)
  ) {
    try {
      const { canvas } = cropperRef.value.getResult();
      if (!canvas) {
        throw new Error("The cropper returned no canvas");
      }
      const resizedCanvas = resizeCanvas(
        canvas,
        maxWidth.value,
        maxHeight.value,
      );
      // A max larger than the image resizes nothing, so there is no file.
      if (hasModifiedCrop.value || resizedCanvas !== canvas) {
        const file = await canvasToFile(
          resizedCanvas,
          item.filename ?? "image",
          getExportSettings(item.mimeType ?? ""),
        );
        cropData = { file };
      }
    } catch {
      saveError.value = "crop";
      isSaving.value = false;
      return;
    }
  }

  const result = await props.save(
    item.id,
    trimmedFilename,
    isImage ? altTextValue.value : undefined,
    cropData,
  );
  isSaving.value = false;
  if (result === "saved") {
    emit("close");
    return;
  }
  if (result === "replaced") {
    markCropApplied();
  }
  saveError.value = "save";
}

// The stored image now matches what is on screen, so a retry sends only the
// metadata. Re-sending the file would write a second version on a provider
// that mints a new URL per replace.
function markCropApplied(): void {
  const box = cropperRef.value?.getResult().coordinates;
  if (box) {
    baselineCoordinates = roundBox(box);
  }
  hasModifiedCrop.value = false;
  maxWidth.value = undefined;
  maxHeight.value = undefined;
  maxWidthInput.value = "";
  maxHeightInput.value = "";
}

function requestClose(): void {
  if (!isSaving.value) {
    emit("close");
  }
}

const dialogRef = ref<HTMLElement | null>(null);
const trapActive = computed(() => props.visible && props.item !== null);
useFocusTrap(dialogRef, trapActive);

function handleKeydown(event: KeyboardEvent): void {
  event.stopPropagation();
  if (event.key === "Enter" && !isSaving.value) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("textarea, [contenteditable]")) {
      return;
    }
    event.preventDefault();
    handleSave();
  }
  if (event.key === "Escape") {
    requestClose();
  }
}
</script>

<template>
  <Teleport :to="popoverTarget || 'body'">
    <Transition
      enter-active-class="tpl:transition tpl:ease-out tpl:duration-150"
      enter-from-class="tpl:opacity-0"
      enter-to-class="tpl:opacity-100"
      leave-active-class="tpl:transition tpl:ease-in tpl:duration-100"
      leave-from-class="tpl:opacity-100"
      leave-to-class="tpl:opacity-0"
    >
      <div
        v-if="visible && item"
        :data-tpl-theme="tplUiTheme"
        :class="[
          popoverTarget ? undefined : 'tpl',
          'tpl:fixed tpl:inset-0 tpl:z-10 tpl:flex tpl:items-center tpl:justify-center tpl:p-4',
        ]"
        style="background-color: var(--tpl-overlay)"
        @click.self="requestClose"
        @keydown="handleKeydown"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpl-media-edit-title"
          class="tpl:flex tpl:max-h-[90%] tpl:w-full tpl:flex-col tpl:overflow-hidden tpl:rounded-lg tpl:shadow-xl"
          :class="isCroppableImage ? 'tpl:max-w-2xl' : 'tpl:max-w-sm'"
          style="background-color: var(--tpl-bg-elevated)"
        >
          <!-- Header -->
          <div class="tpl:shrink-0 tpl:p-5 tpl:pb-4">
            <h3
              id="tpl-media-edit-title"
              class="tpl:text-sm tpl:font-semibold"
              style="color: var(--tpl-text)"
            >
              {{ t.mediaLibrary.editFile }}
            </h3>
          </div>

          <!-- Scrollable content -->
          <div class="tpl:min-h-0 tpl:flex-1 tpl:overflow-y-auto tpl:px-5">
            <!-- Image Cropper (for images only) -->
            <div v-if="isCroppableImage" class="tpl:mb-4">
              <!-- Cropper -->
              <div
                class="tpl:relative tpl:mb-3 tpl:overflow-hidden tpl:rounded-md tpl:border"
                style="
                  border-color: var(--tpl-border);
                  height: 300px;
                  background-color: var(--tpl-bg);
                "
              >
                <Cropper
                  ref="cropperRef"
                  :src="item.url"
                  :stencil-props="{
                    aspectRatio: aspectRatioValue,
                  }"
                  class="tpl:h-full tpl:w-full"
                  background-class="tpl-cropper-background"
                  :default-size="fullImageSize"
                  @change="handleCropChange"
                  @ready="handleImageReady"
                />
              </div>

              <!-- Crop controls -->
              <div class="tpl:space-y-3">
                <!-- Aspect ratio -->
                <div>
                  <label
                    class="tpl:mb-1.5 tpl:block tpl:text-xs tpl:font-medium"
                    style="color: var(--tpl-text-muted)"
                  >
                    {{ t.mediaLibrary.cropAspectRatio }}
                  </label>
                  <div class="tpl:flex tpl:flex-wrap tpl:gap-1.5">
                    <button
                      v-for="preset in [
                        'free',
                        'square',
                        'landscape43',
                        'landscape169',
                        'original',
                      ] as const"
                      :key="preset"
                      type="button"
                      class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
                      :style="{
                        borderColor:
                          aspectRatio === preset
                            ? 'var(--tpl-primary)'
                            : 'var(--tpl-border)',
                        backgroundColor:
                          aspectRatio === preset
                            ? 'var(--tpl-primary-light)'
                            : 'var(--tpl-bg)',
                        color:
                          aspectRatio === preset
                            ? 'var(--tpl-primary)'
                            : 'var(--tpl-text)',
                      }"
                      @click="aspectRatio = preset"
                    >
                      {{
                        mediaT[
                          `crop${preset.charAt(0).toUpperCase()}${preset.slice(1)}`
                        ]
                      }}
                    </button>
                  </div>
                </div>

                <!-- Max dimensions -->
                <div class="tpl:flex tpl:gap-3">
                  <div class="tpl:flex-1">
                    <label
                      class="tpl:mb-1 tpl:block tpl:text-xs tpl:font-medium"
                      style="color: var(--tpl-text-muted)"
                    >
                      {{ t.mediaLibrary.cropMaxWidth }}
                      <span
                        class="tpl:font-normal"
                        style="color: var(--tpl-text-dim)"
                      >
                        {{ t.mediaLibrary.cropOptional }}
                      </span>
                    </label>
                    <div class="tpl:relative">
                      <input
                        :value="maxWidthInput"
                        type="number"
                        min="1"
                        class="tpl:w-full tpl:rounded-md tpl:border tpl:py-1.5 tpl:pr-8 tpl:pl-3 tpl:text-xs tpl:outline-none"
                        style="
                          border-color: var(--tpl-border);
                          background-color: var(--tpl-bg);
                          color: var(--tpl-text);
                        "
                        :placeholder="cropCoordinates?.width?.toString() || ''"
                        @input="handleMaxWidthInput"
                      />
                      <span
                        class="tpl:absolute tpl:top-1/2 tpl:right-2.5 tpl:-translate-y-1/2 tpl:text-xs"
                        style="color: var(--tpl-text-dim)"
                      >
                        {{ t.mediaLibrary.cropPixels }}
                      </span>
                    </div>
                  </div>
                  <div class="tpl:flex-1">
                    <label
                      class="tpl:mb-1 tpl:block tpl:text-xs tpl:font-medium"
                      style="color: var(--tpl-text-muted)"
                    >
                      {{ t.mediaLibrary.cropMaxHeight }}
                      <span
                        class="tpl:font-normal"
                        style="color: var(--tpl-text-dim)"
                      >
                        {{ t.mediaLibrary.cropOptional }}
                      </span>
                    </label>
                    <div class="tpl:relative">
                      <input
                        :value="maxHeightInput"
                        type="number"
                        min="1"
                        class="tpl:w-full tpl:rounded-md tpl:border tpl:py-1.5 tpl:pr-8 tpl:pl-3 tpl:text-xs tpl:outline-none"
                        style="
                          border-color: var(--tpl-border);
                          background-color: var(--tpl-bg);
                          color: var(--tpl-text);
                        "
                        :placeholder="cropCoordinates?.height?.toString() || ''"
                        @input="handleMaxHeightInput"
                      />
                      <span
                        class="tpl:absolute tpl:top-1/2 tpl:right-2.5 tpl:-translate-y-1/2 tpl:text-xs"
                        style="color: var(--tpl-text-dim)"
                      >
                        {{ t.mediaLibrary.cropPixels }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Output dimensions -->
                <div
                  v-if="outputDimensions"
                  class="tpl:flex tpl:items-center tpl:gap-1 tpl:text-xs"
                  style="color: var(--tpl-text-muted)"
                >
                  <span> {{ t.mediaLibrary.cropOutputSize }}: </span>
                  <span class="tpl:font-medium" style="color: var(--tpl-text)">
                    {{ outputDimensions.width }} x
                    {{ outputDimensions.height }}
                    {{ t.mediaLibrary.cropPixels }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Filename -->
            <div class="tpl:mb-3">
              <label
                for="tpl-media-filename"
                class="tpl:mb-1 tpl:block tpl:text-xs tpl:font-medium"
                style="color: var(--tpl-text-muted)"
              >
                {{ t.mediaLibrary.fileName }}
              </label>
              <input
                id="tpl-media-filename"
                v-model="filenameValue"
                type="text"
                class="tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:outline-none"
                style="
                  border-color: var(--tpl-border);
                  background-color: var(--tpl-bg);
                  color: var(--tpl-text);
                "
                :autofocus="!isCroppableImage"
              />
            </div>

            <!-- Alt Text (images only) -->
            <div v-if="isImageMimeType(item.mimeType ?? '')" class="tpl:mb-4">
              <label
                for="tpl-media-alt"
                class="tpl:mb-1 tpl:block tpl:text-xs tpl:font-medium"
                style="color: var(--tpl-text-muted)"
              >
                {{ t.mediaLibrary.altText }}
              </label>
              <input
                id="tpl-media-alt"
                v-model="altTextValue"
                type="text"
                class="tpl:w-full tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:outline-none"
                style="
                  border-color: var(--tpl-border);
                  background-color: var(--tpl-bg);
                  color: var(--tpl-text);
                "
                :placeholder="t.mediaLibrary.altTextPlaceholder"
              />
            </div>
          </div>

          <!-- Outside the scroll region, so it stays beside Save on a tall image -->
          <p
            v-if="saveError"
            id="tpl-media-edit-error"
            role="alert"
            class="tpl:shrink-0 tpl:px-5 tpl:pt-3 tpl:text-xs"
            style="color: var(--tpl-danger)"
          >
            {{
              saveError === "crop"
                ? t.mediaLibrary.editCropError
                : t.mediaLibrary.editSaveError
            }}
          </p>

          <!-- Actions -->
          <div
            class="tpl:flex tpl:shrink-0 tpl:justify-end tpl:gap-2 tpl:p-5 tpl:pt-4"
          >
            <button
              class="tpl:cursor-pointer tpl:rounded-md tpl:border tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
              style="
                border-color: var(--tpl-border);
                color: var(--tpl-text);
                background-color: var(--tpl-bg);
              "
              :disabled="isSaving"
              @click="requestClose"
            >
              {{ t.mediaLibrary.cancel }}
            </button>
            <button
              class="tpl:cursor-pointer tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150 tpl:hover:bg-[var(--tpl-primary-hover)] tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
              style="
                background-color: var(--tpl-primary);
                color: var(--tpl-on-primary);
              "
              :disabled="isSaving"
              @click="handleSave"
            >
              {{
                isSaving ? t.mediaLibrary.saving : t.mediaLibrary.saveChanges
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
:deep(.tpl-cropper-background) {
  background-color: var(--tpl-bg) !important;
}

:deep(.vue-advanced-cropper) {
  background-color: transparent !important;
}

:deep(.vue-advanced-cropper__background) {
  background-color: var(--tpl-bg) !important;
}

:deep(.vue-advanced-cropper__foreground) {
  background-color: var(--tpl-overlay) !important;
}
</style>
