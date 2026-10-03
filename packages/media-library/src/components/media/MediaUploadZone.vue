<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { useMediaCategories } from "../../composables/useMediaCategories";
import { useDropZone, useFileDialog } from "@vueuse/core";
import { LoaderCircle, Upload } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { UI_LOCALE_KEY } from "../../keys";
import type { MediaCategory } from "../../types";
import { formatFileSize } from "../../utils/formatFileSize";
import { formatList } from "../../utils/formatList";

defineProps<{
  isUploading: boolean;
  uploadProgress: { current: number; total: number } | null;
}>();

const emit = defineEmits<{
  (e: "upload", files: File[]): void;
}>();

const { t, format } = useI18n();
const uiLocale = inject(UI_LOCALE_KEY, null);

const {
  allAcceptedInputString,
  restrictsMimeTypes,
  availableCategories,
  maxFileSize,
  isAcceptedFile,
} = useMediaCategories();

const CATEGORY_LABEL_KEYS: Record<MediaCategory, string> = {
  images: "filterImages",
  documents: "filterDocuments",
  videos: "filterVideos",
  audio: "filterAudio",
};

// Read from the provider's limits, never a fixed string: the hint is the only
// place an author learns what the library will refuse.
const acceptedHint = computed(() => {
  const labels = t.mediaLibrary as Record<string, string>;
  const formats = restrictsMimeTypes.value
    ? formatList(
        availableCategories.value.map(
          (category) => labels[CATEGORY_LABEL_KEYS[category]],
        ),
        uiLocale?.value,
      )
    : t.mediaLibrary.acceptedAnyType;
  if (!Number.isFinite(maxFileSize.value)) {
    return formats;
  }
  return format(t.mediaLibrary.acceptedFormatsMaxSize, {
    formats,
    size: formatFileSize(maxFileSize.value),
  });
});

const rejectedNames = ref<string[]>([]);

const dropZoneRef = ref<HTMLElement>();

function emitValidFiles(fileList: File[] | FileList): void {
  const valid: File[] = [];
  const rejected: string[] = [];
  for (const file of Array.from(fileList)) {
    if (isAcceptedFile(file)) {
      valid.push(file);
    } else {
      rejected.push(file.name);
    }
  }
  rejectedNames.value = rejected;
  if (valid.length) {
    emit("upload", valid);
  }
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (files) => {
    if (files?.length) {
      emitValidFiles(files);
    }
  },
});

const { open: openFilePicker, onChange } = useFileDialog({
  accept: allAcceptedInputString.value,
  multiple: true,
});

onChange((fileList) => {
  if (fileList?.length) {
    emitValidFiles(fileList);
  }
});
</script>

<template>
  <button
    ref="dropZoneRef"
    type="button"
    data-testid="media-upload-zone"
    class="tpl-upload-zone tpl:flex tpl:w-full tpl:cursor-pointer tpl:flex-col tpl:items-center tpl:justify-center tpl:rounded-lg tpl:border-2 tpl:border-dashed tpl:p-5 tpl:text-center tpl:transition-all tpl:duration-150"
    :class="isOverDropZone ? 'tpl-upload-zone-active' : ''"
    :aria-label="t.mediaLibrary.dropOrClick"
    :aria-describedby="isUploading ? undefined : 'tpl-media-upload-hint'"
    :aria-busy="isUploading"
    style="
      border-color: var(--tpl-border-light);
      background-color: var(--tpl-bg);
    "
    @click="openFilePicker()"
  >
    <div v-if="isUploading" class="tpl:flex tpl:items-center tpl:gap-2">
      <LoaderCircle
        class="tpl-spinner"
        :size="20"
        :stroke-width="2"
        style="color: var(--tpl-primary)"
      />
      <span class="tpl:text-xs" style="color: var(--tpl-text-muted)">{{
        uploadProgress && uploadProgress.total > 1
          ? format(t.mediaLibrary.uploadingProgress, {
              current: uploadProgress.current,
              total: uploadProgress.total,
            })
          : t.mediaLibrary.uploading
      }}</span>
    </div>
    <template v-else>
      <Upload
        class="tpl:mb-2"
        :size="24"
        :stroke-width="1.5"
        style="color: var(--tpl-text-dim)"
      />
      <p class="tpl:text-xs" style="color: var(--tpl-text-muted)">
        {{ t.mediaLibrary.dropOrClick }}
      </p>
      <p
        id="tpl-media-upload-hint"
        data-testid="media-upload-hint"
        class="tpl:mt-1 tpl:text-[10px]"
        style="color: var(--tpl-text-dim)"
      >
        {{ acceptedHint }}
      </p>
    </template>
  </button>
  <p
    v-if="rejectedNames.length"
    data-testid="media-upload-rejected"
    role="alert"
    class="tpl:mt-1.5 tpl:text-xs tpl:break-words"
    style="color: var(--tpl-danger)"
  >
    {{
      format(t.mediaLibrary.uploadRejected, {
        files: rejectedNames.join(", "),
      })
    }}
  </p>
</template>
