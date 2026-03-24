<script setup lang="ts">
import { useI18n } from '../../../composables';
import { useMediaCategories } from '../../composables/useMediaCategories';
import { useDropZone, useFileDialog } from '@vueuse/core';
import { Loader2, Upload } from 'lucide-vue-next';
import { ref } from 'vue';

defineProps<{
    isUploading: boolean;
    uploadProgress: { current: number; total: number } | null;
}>();

const emit = defineEmits<{
    (e: 'upload', files: File[]): void;
}>();

const { t, format } = useI18n();

const { allAcceptedMimeTypes, allAcceptedInputString, maxFileSize } =
    useMediaCategories();

const dropZoneRef = ref<HTMLDivElement>();

function validateFiles(fileList: File[] | FileList): File[] {
    const valid: File[] = [];
    for (const file of Array.from(fileList)) {
        if (
            allAcceptedMimeTypes.value.includes(file.type) &&
            file.size <= maxFileSize.value
        ) {
            valid.push(file);
        }
    }
    return valid;
}

function emitValidFiles(files: File[] | FileList): void {
    const valid = validateFiles(files);
    if (valid.length) {
        emit('upload', valid);
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
    <div
        ref="dropZoneRef"
        class="tpl-upload-zone tpl:flex tpl:cursor-pointer tpl:flex-col tpl:items-center tpl:justify-center tpl:rounded-lg tpl:border-2 tpl:border-dashed tpl:p-5 tpl:text-center tpl:transition-all tpl:duration-150"
        :class="isOverDropZone ? 'tpl-upload-zone-active' : ''"
        style="
            border-color: var(--tpl-border-light);
            background-color: var(--tpl-bg);
        "
        @click="openFilePicker()"
    >
        <div v-if="isUploading" class="tpl:flex tpl:items-center tpl:gap-2">
            <Loader2
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
                class="tpl:mt-1 tpl:text-[10px]"
                style="color: var(--tpl-text-dim)"
            >
                {{ t.mediaLibrary.acceptedFormats }}
            </p>
        </template>
    </div>
</template>
