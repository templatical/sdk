<script setup lang="ts">
import { useMergeTagField } from "../composables/useMergeTagField";
import { inputClass } from "../constants/styleConstants";
import MergeTagSegments from "./MergeTagSegments.vue";
import MergeTagInsertButton from "./MergeTagInsertButton.vue";
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    type?: "text" | "url";
    placeholder?: string;
    pulse?: boolean;
  }>(),
  {
    type: "text",
    placeholder: "",
    pulse: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);

const {
  segments,
  hasMergeTags,
  canRequestMergeTag,
  isRequestingMergeTag,
  isEditing,
  startEditing,
  stopEditing,
  handleInput,
  clearValue,
  insertMergeTag,
} = useMergeTagField({
  modelValue: () => props.modelValue,
  emit: (value) => emit("update:modelValue", value),
  elementRef: inputRef,
});

const displayClass =
  "tpl:flex tpl:w-full tpl:min-h-10 tpl:cursor-pointer tpl:items-center tpl:flex-wrap tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:shadow-xs tpl:bg-[var(--tpl-bg)] tpl:border-[var(--tpl-border)] tpl:px-3.5 tpl:py-1.5 tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]";
</script>

<template>
  <div v-if="hasMergeTags && !isEditing">
    <MergeTagSegments
      :segments="segments"
      :display-class="displayClass"
      :pulse="pulse"
      @edit="startEditing"
      @clear="clearValue"
    />
    <MergeTagInsertButton
      v-if="canRequestMergeTag"
      :disabled="isRequestingMergeTag"
      @insert="insertMergeTag"
    />
  </div>
  <div v-else>
    <input
      ref="inputRef"
      :type="type"
      :class="[inputClass, { 'tpl-pulse-fill': pulse }]"
      :value="modelValue"
      :placeholder="placeholder"
      @input="handleInput"
      @blur="stopEditing"
      @keydown.escape="stopEditing"
    />
    <MergeTagInsertButton
      v-if="canRequestMergeTag"
      :disabled="isRequestingMergeTag"
      @insert="insertMergeTag"
    />
  </div>
</template>

<style scoped>
.tpl-pulse-fill {
  animation: tpl-field-pulse 1s ease-out;
}

@keyframes tpl-field-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--tpl-warning) 30%, transparent);
    background-color: color-mix(in srgb, var(--tpl-warning) 6%, transparent);
  }
  40% {
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--tpl-warning) 15%, transparent);
    background-color: color-mix(in srgb, var(--tpl-warning) 5%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
    background-color: transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tpl-pulse-fill {
    animation: none;
  }
}
</style>
