<script setup lang="ts">
import { useMergeTagField } from "../composables/useMergeTagField";
import MergeTagSegments from "./MergeTagSegments.vue";
import MergeTagInsertButton from "./MergeTagInsertButton.vue";
import LogicTagInsertButton from "./LogicTagInsertButton.vue";
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    rows?: number;
  }>(),
  {
    placeholder: "",
    rows: 3,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

const {
  segments,
  hasMergeTags,
  canRequestMergeTag,
  isRequestingMergeTag,
  canInsertLogicTag,
  isRequestingLogicTag,
  isEditing,
  startEditing,
  handleInput,
  handleKeydown,
  handleClick,
  handleBlur,
  clearValue,
  insertMergeTag,
  insertLogicTag,
} = useMergeTagField({
  modelValue: () => props.modelValue,
  emit: (value) => emit("update:modelValue", value),
  elementRef: textareaRef,
});

const textareaClass =
  "tpl:w-full tpl:resize-y tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:shadow-xs tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:text-sm tpl:text-[var(--tpl-text)] tpl:outline-none tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[var(--tpl-ring)]";
const displayClass =
  "tpl:flex tpl:w-full tpl:min-h-20 tpl:cursor-pointer tpl:items-start tpl:flex-wrap tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:shadow-xs tpl:bg-[var(--tpl-bg)] tpl:border-[var(--tpl-border)] tpl:px-3 tpl:py-2 tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]";
</script>

<template>
  <div v-if="hasMergeTags && !isEditing">
    <MergeTagSegments
      :segments="segments"
      :display-class="displayClass"
      @edit="startEditing"
      @clear="clearValue"
    />
    <div
      v-if="canRequestMergeTag || canInsertLogicTag"
      class="tpl:flex tpl:flex-wrap tpl:gap-1.5"
    >
      <MergeTagInsertButton
        v-if="canRequestMergeTag"
        :disabled="isRequestingMergeTag"
        @insert="insertMergeTag"
      />
      <LogicTagInsertButton
        v-if="canInsertLogicTag"
        :disabled="isRequestingLogicTag"
        @insert="insertLogicTag"
      />
    </div>
  </div>
  <div v-else>
    <textarea
      ref="textareaRef"
      :class="textareaClass"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      @input="handleInput"
      @keydown="handleKeydown"
      @click="handleClick"
      @blur="handleBlur"
    />
    <div
      v-if="canRequestMergeTag || canInsertLogicTag"
      class="tpl:flex tpl:flex-wrap tpl:gap-1.5"
    >
      <MergeTagInsertButton
        v-if="canRequestMergeTag"
        :disabled="isRequestingMergeTag"
        @insert="insertMergeTag"
      />
      <LogicTagInsertButton
        v-if="canInsertLogicTag"
        :disabled="isRequestingLogicTag"
        @insert="insertLogicTag"
      />
    </div>
  </div>
</template>
