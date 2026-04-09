<script setup lang="ts">
import { useI18n } from "../../../composables/useI18n";
import type { CustomBlockImageField } from "@templatical/types";
import { inputClass } from "../../../constants/styleConstants";
import { Image } from "@lucide/vue";
import { computed, inject } from "vue";
import { ON_REQUEST_MEDIA_KEY } from "../../../keys";
import FieldWrapper from "./FieldWrapper.vue";

defineProps<{
  field: CustomBlockImageField;
  modelValue: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();
const onRequestMedia = inject(ON_REQUEST_MEDIA_KEY, null);

const canBrowseMedia = computed(() => !!onRequestMedia);

async function browseMedia(): Promise<void> {
  const result = await onRequestMedia?.({ accept: ["images"] });
  if (result) {
    emit("update:modelValue", result.url);
  }
}
</script>

<template>
  <FieldWrapper
    :label="field.label"
    :required="field.required"
    :read-only="readOnly"
  >
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
      class="tpl:mt-2 tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:transition-all tpl:duration-150"
      style="
        border-color: var(--tpl-border);
        color: var(--tpl-primary);
        background-color: var(--tpl-bg);
      "
      @click="browseMedia()"
    >
      <Image :size="14" :stroke-width="1.5" />
      {{ t.image.browseMedia }}
    </button>
  </FieldWrapper>
</template>
