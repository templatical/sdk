<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { useMergeTagField } from "../composables/useMergeTagField";
import { inputClass } from "../constants/styleConstants";
import { ScanLine, X } from "@lucide/vue";
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

const { t } = useI18n();

const inputRef = ref<HTMLInputElement | null>(null);

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
  elementRef: inputRef,
});

const displayClass =
  "tpl:flex tpl:w-full tpl:min-h-10 tpl:cursor-pointer tpl:items-center tpl:flex-wrap tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:shadow-xs tpl:bg-[var(--tpl-bg)] tpl:border-[var(--tpl-border)] tpl:px-3.5 tpl:py-1.5 tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]";
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
      :class="[displayClass, { 'tpl-pulse-fill': pulse }]"
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
  <!-- Regular input mode -->
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
