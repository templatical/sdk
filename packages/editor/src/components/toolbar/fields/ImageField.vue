<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockImageField } from "@templatical/types";
import { inputClass } from "../../../constants/styleConstants";
import { Image, Upload, LoaderCircle } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { ON_REQUEST_MEDIA_KEY } from "../../../keys";
import { useAliveFlag } from "../../../composables/useAliveFlag";
import { useImageDrop } from "../../../composables/useImageDrop";
import FieldWrapper from "./FieldWrapper.vue";

const props = defineProps<{
  field: CustomBlockImageField;
  modelValue: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();
const onRequestMedia = inject(ON_REQUEST_MEDIA_KEY, null);
const aliveFlag = useAliveFlag();

const canBrowseMedia = computed(() => !!onRequestMedia);

async function browseMedia(): Promise<void> {
  const result = await onRequestMedia?.({ accept: ["images"] });
  if (!aliveFlag.alive) return;
  if (result) {
    emit("update:modelValue", result.url);
  }
}

// --- Drag-and-drop upload (#229) ---
const dropZoneRef = ref<HTMLElement>();
const isUploading = ref(false);
const dropEnabled = computed(
  () => canBrowseMedia.value && !isUploading.value && !props.readOnly,
);

async function uploadDroppedFiles(files: File[]): Promise<void> {
  if (!onRequestMedia) return;
  isUploading.value = true;
  try {
    const result = await onRequestMedia({ accept: ["images"], files });
    if (!aliveFlag.alive) return;
    if (result) emit("update:modelValue", result.url);
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
  <FieldWrapper
    :label="field.label"
    :required="field.required"
    :read-only="readOnly"
  >
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
      <input
        v-if="readOnly"
        type="url"
        :class="[inputClass, 'tpl:opacity-60 tpl:cursor-not-allowed']"
        :value="modelValue"
        :placeholder="field.placeholder || 'https://...'"
        disabled
        :title="t.customBlocks.dataSource.readOnlyTooltip"
      />
      <input
        v-else
        type="url"
        :class="inputClass"
        :value="modelValue"
        :placeholder="field.placeholder || 'https://...'"
        @input="
          emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
      />
      <button
        v-if="canBrowseMedia && !readOnly"
        class="tpl:mt-2 tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150 tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-primary)] tpl:bg-[var(--tpl-bg)]"
        @click="browseMedia()"
      >
        <Image :size="14" :stroke-width="1.5" />
        {{ t.image.browseMedia }}
      </button>
    </div>
  </FieldWrapper>
</template>
