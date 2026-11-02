<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockImageField } from "@templatical/types";
import { inputClass } from "../../../constants/styleConstants";
import { Image } from "@lucide/vue";
import { ref } from "vue";
import { useMediaDropField } from "../../../composables/useMediaDropField";
import MediaDropOverlay from "../../MediaDropOverlay.vue";
import FieldWrapper from "./FieldWrapper.vue";

const props = defineProps<{
  field: CustomBlockImageField;
  modelValue: string;
  readOnly?: boolean;
  hideLabel?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();

const dropZoneRef = ref<HTMLElement>();
const { canBrowse, isUploading, showOverlay, openMediaBrowser } =
  useMediaDropField({
    target: dropZoneRef,
    blocked: () => !!props.readOnly,
    apply: (result) => emit("update:modelValue", result.url),
  });
</script>

<template>
  <FieldWrapper
    :hide-label="hideLabel"
    :label="field.label"
    :required="field.required"
    :read-only="readOnly"
  >
    <div ref="dropZoneRef" class="tpl:relative">
      <MediaDropOverlay v-if="showOverlay" :uploading="isUploading" />
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
        v-if="canBrowse && !readOnly"
        class="tpl:mt-2 tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:border-[var(--tpl-border)] tpl:text-[var(--tpl-primary)] tpl:bg-[var(--tpl-bg)]"
        @click="openMediaBrowser()"
      >
        <Image :size="14" :stroke-width="1.5" />
        {{ t.image.browseMedia }}
      </button>
    </div>
  </FieldWrapper>
</template>
