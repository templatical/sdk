<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { useMergeTag } from "../composables/useMergeTag";
import { NodeViewWrapper } from "@tiptap/vue-3";
import { computed, nextTick, ref } from "vue";

const props = defineProps<{
  node: {
    attrs: {
      label: string;
      value: string;
    };
  };
  deleteNode: () => void;
  updateAttributes: (attrs: Record<string, unknown>) => void;
}>();

const { getMergeTagLabel } = useMergeTag();
const { t } = useI18n();

const displayLabel = computed(() => getMergeTagLabel(props.node.attrs.value));

const isEditing = ref(false);
const editValue = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

function startEditing(): void {
  editValue.value = props.node.attrs.value;
  isEditing.value = true;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

function finishEditing(): void {
  const newValue = editValue.value.trim();
  if (newValue && newValue !== props.node.attrs.value) {
    // Update with new value and derive label from it
    props.updateAttributes({
      value: newValue,
      label: getMergeTagLabel(newValue),
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
    class="tpl-merge-tag-node tpl:group tpl:mx-0.5 tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[0.9em] tpl:font-medium tpl:select-none"
    style="
      background-color: color-mix(in srgb, var(--tpl-primary) 20%, transparent);
      color: var(--tpl-primary);
    "
    contenteditable="false"
  >
    <!-- Edit mode -->
    <input
      v-if="isEditing"
      ref="inputRef"
      v-model="editValue"
      type="text"
      class="tpl:w-32 tpl:rounded tpl:border-none tpl:bg-transparent tpl:px-0.5 tpl:py-0 tpl:text-[1em] tpl:font-medium tpl:outline-none"
      style="color: var(--tpl-primary)"
      @blur="finishEditing"
      @keydown="handleKeydown"
    />
    <!-- Display mode -->
    <span
      v-else
      role="button"
      tabindex="0"
      :aria-label="t.mergeTag.editValue"
      class="tpl-tooltip tpl:cursor-pointer"
      :data-tooltip="node.attrs.value"
      @click.stop="startEditing"
      @keydown.enter.stop="startEditing"
      @keydown.space.prevent.stop="startEditing"
    >
      {{ displayLabel }}
    </span>
    <button
      type="button"
      :aria-label="t.mergeTag.deleteMergeTag"
      class="tpl-merge-tag-delete tpl:flex tpl:size-5 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-none tpl:bg-transparent tpl:p-0 tpl:opacity-60 tpl:transition-all hover:tpl:opacity-100"
      style="color: var(--tpl-primary)"
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
