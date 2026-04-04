<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { useMergeTag } from "../composables/useMergeTag";
import {
  getLogicMergeTagKeyword,
  isLogicMergeTagValue,
} from "@templatical/types";
import { ScanLine, X } from "@lucide/vue";
import { computed, nextTick, ref } from "vue";

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

const {
  isEnabled: mergeTagEnabled,
  isRequesting: isRequestingMergeTag,
  isMergeTagValue,
  getMergeTagLabel,
  requestMergeTag,
  syntax,
} = useMergeTag();

const isEditing = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
let insertingMergeTag = false;

type Segment =
  | { type: "text"; value: string }
  | { type: "mergeTag"; value: string; label: string }
  | { type: "logicMergeTag"; value: string; keyword: string };

const segments = computed((): Segment[] => {
  const val = props.modelValue;
  if (!val) return [];

  const result: Segment[] = [];
  const combinedSource = `(${syntax.value.source}|${syntax.logic.source})`;
  const regex = new RegExp(combinedSource, "g");
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(val)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        type: "text",
        value: val.slice(lastIndex, match.index),
      });
    }

    const matched = match[0];
    if (isMergeTagValue(matched)) {
      result.push({
        type: "mergeTag",
        value: matched,
        label: getMergeTagLabel(matched),
      });
    } else if (isLogicMergeTagValue(matched, syntax)) {
      result.push({
        type: "logicMergeTag",
        value: matched,
        keyword: getLogicMergeTagKeyword(matched, syntax),
      });
    } else {
      result.push({ type: "text", value: matched });
    }

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < val.length) {
    result.push({ type: "text", value: val.slice(lastIndex) });
  }

  return result;
});

const hasMergeTags = computed(() =>
  segments.value.some(
    (s) => s.type === "mergeTag" || s.type === "logicMergeTag",
  ),
);

function startEditing(): void {
  isEditing.value = true;
  nextTick(() => {
    textareaRef.value?.focus();
    const len = props.modelValue?.length || 0;
    textareaRef.value?.setSelectionRange(len, len);
  });
}

function stopEditing(): void {
  if (insertingMergeTag) return;
  isEditing.value = false;
}

function handleInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
}

function clearValue(): void {
  emit("update:modelValue", "");
}

async function insertMergeTag(): Promise<void> {
  const cursorPos =
    isEditing.value && textareaRef.value
      ? (textareaRef.value.selectionStart ?? props.modelValue.length)
      : props.modelValue.length;

  insertingMergeTag = true;
  const mergeTag = await requestMergeTag();
  insertingMergeTag = false;

  if (mergeTag) {
    const before = props.modelValue.slice(0, cursorPos);
    const after = props.modelValue.slice(cursorPos);
    const newValue = before + mergeTag.value + after;
    emit("update:modelValue", newValue);

    isEditing.value = true;
    nextTick(() => {
      const newPos = cursorPos + mergeTag.value.length;
      textareaRef.value?.focus();
      textareaRef.value?.setSelectionRange(newPos, newPos);
    });
  }
}

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
        class="tpl:ml-auto tpl:flex tpl:size-4 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-[var(--tpl-text-dim)] tpl:opacity-60 tpl:transition-all hover:tpl:text-[var(--tpl-danger)] hover:tpl:opacity-100"
        :aria-label="t.mergeTag.remove"
        :title="t.mergeTag.remove"
        @click.stop="clearValue"
      >
        <X :size="10" :stroke-width="3" />
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
