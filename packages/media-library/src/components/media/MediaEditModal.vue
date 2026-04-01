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
import type { MediaItem } from "../../types";
import { computed, inject, ref, watch, type Ref } from "vue";
import { Cropper, type CropperResult } from "vue-advanced-cropper";
import "vue-advanced-cropper/dist/style.css";

export interface CropData {
  file: File;
}

const props = defineProps<{
  visible: boolean;
  item: MediaItem | null;
}>();

const emit = defineEmits<{
  (
    e: "save",
    id: string,
    filename: string,
    altText?: string,
    cropData?: CropData,
  ): void;
  (e: "close"): void;
}>();

const { t } = useI18n();
const tplUiTheme = inject<Ref<"light" | "dark">>("tplUiTheme");
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

const isCroppableImage = computed(() => {
  if (!props.item) {
    return false;
  }

  const croppableMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  return croppableMimeTypes.includes(props.item.mime_type);
});

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
      filenameValue.value = props.item.filename;
      altTextValue.value = props.item.alt_text || "";
      aspectRatio.value = "free";
      maxWidth.value = undefined;
      maxHeight.value = undefined;
      maxWidthInput.value = "";
      maxHeightInput.value = "";
      originalAspectRatio.value = undefined;
      cropCoordinates.value = null;
      imageLoaded.value = false;
      hasModifiedCrop.value = false;

      if (props.item.width && props.item.height) {
        originalAspectRatio.value = props.item.width / props.item.height;
      }
    }
  },
);

function handleCropChange(result: CropperResult): void {
  if (result.coordinates) {
    cropCoordinates.value = {
      width: Math.round(result.coordinates.width),
      height: Math.round(result.coordinates.height),
    };
    hasModifiedCrop.value = true;
  }
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

  const isImage = isImageMimeType(props.item.mime_type);
  let cropData: CropData | undefined;

  if (isCroppableImage.value && cropperRef.value && hasModifiedCrop.value) {
    isSaving.value = true;
    try {
      const { canvas } = cropperRef.value.getResult();
      if (canvas) {
        const resizedCanvas = resizeCanvas(
          canvas,
          maxWidth.value,
          maxHeight.value,
        );
        const settings = getExportSettings(props.item.mime_type);
        const file = await canvasToFile(
          resizedCanvas,
          props.item.filename,
          settings,
        );
        cropData = { file };
      }
    } catch {
      isSaving.value = false;
      return;
    }
    isSaving.value = false;
  }

  emit(
    "save",
    props.item.id,
    trimmedFilename,
    isImage ? altTextValue.value : undefined,
    cropData,
  );
  emit("close");
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !isSaving.value) {
    event.preventDefault();
    handleSave();
  }
  if (event.key === "Escape") {
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
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
        class="tpl tpl:fixed tpl:inset-0 tpl:z-[10000] tpl:flex tpl:items-center tpl:justify-center"
        style="background-color: var(--tpl-overlay)"
        @click.self="emit('close')"
        @keydown="handleKeydown"
      >
        <div
          class="tpl:mx-4 tpl:flex tpl:max-h-[90vh] tpl:w-full tpl:flex-col tpl:overflow-hidden tpl:rounded-lg tpl:shadow-xl"
          :class="isCroppableImage ? 'tpl:max-w-2xl' : 'tpl:max-w-sm'"
          style="background-color: var(--tpl-bg-elevated)"
        >
          <!-- Header -->
          <div class="tpl:shrink-0 tpl:p-5 tpl:pb-4">
            <h3
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
                class="tpl:mb-1 tpl:block tpl:text-xs tpl:font-medium"
                style="color: var(--tpl-text-muted)"
              >
                {{ t.mediaLibrary.fileName }}
              </label>
              <input
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
            <div v-if="isImageMimeType(item.mime_type)" class="tpl:mb-4">
              <label
                class="tpl:mb-1 tpl:block tpl:text-xs tpl:font-medium"
                style="color: var(--tpl-text-muted)"
              >
                {{ t.mediaLibrary.altText }}
              </label>
              <input
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
              @click="emit('close')"
            >
              {{ t.mediaLibrary.cancel }}
            </button>
            <button
              class="tpl:cursor-pointer tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:text-white tpl:transition-all tpl:duration-150 tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
              style="
                background: linear-gradient(
                  135deg,
                  var(--tpl-primary),
                  var(--tpl-primary-hover)
                );
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
