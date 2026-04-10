<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { useMergeTag } from "../composables/useMergeTag";
import {
  getLogicMergeTagKeyword,
  isLogicMergeTagValue,
} from "@templatical/types";
import type { Editor } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/vue-3";
import { computed, nextTick, ref } from "vue";

const props = defineProps<{
  node: {
    attrs: {
      value: string;
      keyword: string;
    };
  };
  editor: Editor;
  getPos: () => number;
  deleteNode: () => void;
  updateAttributes: (attrs: Record<string, unknown>) => void;
}>();

const { syntax } = useMergeTag();
const { t } = useI18n();

const isValid = computed(() =>
  isLogicMergeTagValue(props.node.attrs.value, syntax),
);
const displayKeyword = computed(() =>
  getLogicMergeTagKeyword(props.node.attrs.value, syntax),
);

const isEditing = ref(false);
const editValue = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
let handled = false;

function startEditing(): void {
  editValue.value = props.node.attrs.value;
  handled = false;
  isEditing.value = true;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

function finishEditing(): void {
  if (handled) {
    return;
  }
  handled = true;

  const newValue = editValue.value.trim();
  if (!newValue) {
    isEditing.value = false;
    return;
  }

  if (newValue !== props.node.attrs.value) {
    props.updateAttributes({
      value: newValue,
      keyword: isLogicMergeTagValue(newValue, syntax)
        ? getLogicMergeTagKeyword(newValue, syntax)
        : "",
    });
  }
  isEditing.value = false;
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault();
    finishEditing();
  } else if (event.key === "Escape") {
    isEditing.value = false;
  }
}
</script>

<template>
  <NodeViewWrapper
    as="span"
    :class="
      isValid
        ? 'tpl-logic-merge-tag-node tpl:group tpl:mx-0.5 tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[0.8em] tpl:font-bold tpl:tracking-wide tpl:uppercase tpl:select-none'
        : ''
    "
    :style="
      isValid
        ? 'background-color: transparent; border: 1.5px solid color-mix(in srgb, var(--tpl-primary) 50%, transparent); color: var(--tpl-primary);'
        : ''
    "
    contenteditable="false"
  >
    <!-- Edit mode -->
    <input
      v-if="isEditing"
      ref="inputRef"
      v-model="editValue"
      type="text"
      class="tpl:w-40 tpl:rounded tpl:border-none tpl:bg-transparent tpl:px-0.5 tpl:py-0 tpl:text-[1em] tpl:font-medium tpl:normal-case tpl:outline-none tpl:text-[var(--tpl-primary)]"
      @blur="finishEditing"
      @keydown="handleKeydown"
    />
    <!-- Display mode: valid merge tag -->
    <span
      v-else-if="isValid"
      role="button"
      tabindex="0"
      :aria-label="t.mergeTag.editValue"
      class="tpl-tooltip tpl:cursor-pointer"
      :data-tooltip="node.attrs.value"
      @click.stop="startEditing"
      @keydown.enter.stop="startEditing"
      @keydown.space.prevent.stop="startEditing"
    >
      {{ displayKeyword }}
    </span>
    <!-- Display mode: invalid (plain text) -->
    <span
      v-else
      role="button"
      tabindex="0"
      :aria-label="t.mergeTag.editValue"
      @click.stop="startEditing"
      @keydown.enter.stop="startEditing"
      @keydown.space.prevent.stop="startEditing"
    >
      {{ node.attrs.value }}
    </span>
    <button
      v-if="isValid"
      type="button"
      :aria-label="t.mergeTag.deleteMergeTag"
      class="tpl-merge-tag-delete tpl:flex tpl:size-5 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-none tpl:bg-transparent tpl:p-0 tpl:opacity-60 tpl:transition-all hover:tpl:opacity-100 tpl:text-[var(--tpl-primary)]"
      contenteditable="false"
      @click.stop.prevent="deleteNode"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </NodeViewWrapper>
</template>
