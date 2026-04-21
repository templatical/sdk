<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { useMergeTagField } from "../composables/useMergeTagField";
import { ScanLine, X } from "@lucide/vue";
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

const { t } = useI18n();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

const {
  segments,
  hasMergeTags,
  mergeTagEnabled,
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
  elementRef: textareaRef,
});

const textareaClass =
  "tpl:w-full tpl:resize-y tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:shadow-xs tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:text-sm tpl:text-[var(--tpl-text)] tpl:outline-none tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[var(--tpl-ring)]";
const displayClass =
  "tpl:flex tpl:w-full tpl:min-h-[5rem] tpl:cursor-pointer tpl:items-start tpl:flex-wrap tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:shadow-xs tpl:bg-[var(--tpl-bg)] tpl:border-[var(--tpl-border)] tpl:px-3 tpl:py-2 tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]";
const mergeTagBtnClass =
  "tpl:flex tpl:items-center tpl:justify-center tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:px-2 tpl:py-1 tpl:text-xs tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-[120ms] hover:tpl:bg-[var(--tpl-primary-light)] hover:tpl:text-[var(--tpl-primary)] hover:tpl:border-[var(--tpl-primary)]";
</script>

<template>
  <!-- Formatted display (has merge tags, not editing) -->
  <div v-if="hasMergeTags && !isEditing">
    <div
      role="button"
      tabindex="0"
      :aria-label="t.mergeTag.clickToEdit"
      :class="displayClass"
      @click="startEditing"
      @keydown.enter="startEditing"
      @keydown.space.prevent="startEditing"
    >
      <template
        v-for="(seg, i) in segments"
        :key="`${seg.type}-${i}-${seg.value}`"
      >
        <span
          v-if="seg.type === 'mergeTag'"
          class="tpl-tooltip tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[0.9em] tpl:font-medium"
          :data-tooltip="seg.value"
          style="
            background-color: color-mix(
              in srgb,
              var(--tpl-primary) 20%,
              transparent
            );
            color: var(--tpl-primary);
          "
        >
          {{ seg.label }}
        </span>
        <span
          v-else-if="seg.type === 'logicMergeTag'"
          class="tpl-tooltip tpl:inline-flex tpl:items-center tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[0.8em] tpl:font-bold tpl:tracking-wide tpl:uppercase"
          :data-tooltip="seg.value"
          style="
            background-color: transparent;
            border: 1.5px solid
              color-mix(in srgb, var(--tpl-primary) 50%, transparent);
            color: var(--tpl-primary);
          "
        >
          {{ seg.keyword }}
        </span>
        <span v-else class="tpl:text-sm tpl:text-[var(--tpl-text)]">{{
          seg.value
        }}</span>
      </template>
      <button
        type="button"
        class="tpl:ml-auto tpl:flex tpl:size-6 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text-dim)] tpl:opacity-60 tpl:transition-all hover:tpl:text-[var(--tpl-danger)] hover:tpl:opacity-100"
        :aria-label="t.mergeTag.remove"
        :title="t.mergeTag.remove"
        @click.stop="clearValue"
      >
        <X :size="12" :stroke-width="2.5" />
      </button>
    </div>
    <button
      v-if="mergeTagEnabled"
      type="button"
      :class="mergeTagBtnClass"
      class="tpl:mt-1.5"
      :aria-label="t.mergeTag.insert"
      :title="t.mergeTag.insert"
      :disabled="isRequestingMergeTag"
      @click="insertMergeTag"
    >
      <ScanLine :size="12" :stroke-width="2" />
      {{ t.mergeTag.insert }}
    </button>
  </div>
  <!-- Regular textarea mode -->
  <div v-else>
    <textarea
      ref="textareaRef"
      :class="textareaClass"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      @input="handleInput"
      @blur="stopEditing"
      @keydown.escape="stopEditing"
    />
    <button
      v-if="mergeTagEnabled"
      type="button"
      :class="mergeTagBtnClass"
      class="tpl:mt-1.5"
      :aria-label="t.mergeTag.insert"
      :title="t.mergeTag.insert"
      :disabled="isRequestingMergeTag"
      @click="insertMergeTag"
    >
      <ScanLine :size="12" :stroke-width="2" />
      {{ t.mergeTag.insert }}
    </button>
  </div>
</template>
