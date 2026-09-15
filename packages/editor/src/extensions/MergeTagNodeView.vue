<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import { useMergeTag } from "../composables/useMergeTag";
import { NodeViewWrapper } from "@tiptap/vue-3";
import { computed, nextTick, onScopeDispose, ref } from "vue";

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

const {
  getMergeTagLabel,
  getMergeTagDisplayLabel,
  findMergeTag,
  canRepickMergeTag,
  showRawValue,
  isMergeTagValue,
  requestMergeTag,
} = useMergeTag();
const { t, format } = useI18n();

// `node.attrs.label` is the label captured when the tag was inserted. It is
// only ever a fallback — the configured tags win, which is what keeps a
// relabelled tag from rendering its stale stored copy.
const displayLabel = computed(() =>
  getMergeTagDisplayLabel(props.node.attrs.value, props.node.attrs.label),
);
const canRepick = computed(() => canRepickMergeTag(props.node.attrs.value));

const isEditing = ref(false);
const editValue = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

// The chooser mounts in the popover root, outside this node view, so the node
// can be torn down while it is open — a collaborator edit, a block change, the
// editor unmounting. Writing attributes onto a destroyed node view throws.
let disposed = false;
onScopeDispose(() => {
  disposed = true;
});

/** Whether the text currently in the raw input is a usable merge tag. */
const isEditValueValid = computed(
  () =>
    editValue.value.trim() === "" || isMergeTagValue(editValue.value.trim()),
);

/**
 * Swap this tag for another one, chosen through the same chooser insertion
 * uses. `requestMergeTag` sets the editor-wide requesting flag for the whole
 * await, which is what stops `useRichTextEditor`'s click-outside handler
 * finishing the block when the user clicks a row in the chooser — that would
 * dispose this node view and silently drop the update.
 */
async function repick(): Promise<void> {
  const replacement = await requestMergeTag({
    reason: "edit",
    current: findMergeTag(props.node.attrs.value),
  });
  if (disposed || !replacement) return;
  props.updateAttributes({
    value: replacement.value,
    label: replacement.label,
  });
}

function startEditing(): void {
  editValue.value = props.node.attrs.value;
  isEditing.value = true;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

/**
 * Activating the chip opens the chooser when one can resolve this token, and
 * the raw input only when none can. Editing a token as free text is how a
 * chip ends up holding something that is not a merge tag at all, which the
 * renderer then emits verbatim into the sent email.
 */
function activate(): void {
  if (canRepick.value) {
    void repick();
    return;
  }
  startEditing();
}

function finishEditing(): void {
  const newValue = editValue.value.trim();
  // Never commit something that isn't a merge tag: `renderHTML` writes the
  // value straight into `data-merge-tag`, and the renderer drops that into the
  // MJML unchanged, so a typo would ship as literal text in the email.
  if (
    newValue &&
    newValue !== props.node.attrs.value &&
    isMergeTagValue(newValue)
  ) {
    props.updateAttributes({
      // The honest resolution, not the display chain: this is written into the
      // document as `data-label`, so a placeholder would be persisted as if it
      // were the tag's name.
      value: newValue,
      label: getMergeTagLabel(newValue),
    });
  }
  isEditing.value = false;
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault();
    // Enter on an invalid value keeps the input open rather than discarding
    // what was typed — the border and `aria-invalid` already say why.
    if (!isEditValueValid.value) return;
    finishEditing();
  } else if (event.key === "Escape") {
    isEditing.value = false;
  }
}
</script>

<template>
  <NodeViewWrapper
    as="span"
    class="tpl-merge-tag-node tpl:group tpl:mx-0.5 tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[0.9em] tpl:font-medium tpl:select-none tpl:text-[var(--tpl-primary)]"
    style="
      background-color: color-mix(in srgb, var(--tpl-primary) 20%, transparent);
    "
    contenteditable="false"
  >
    <!-- Edit mode -->
    <input
      v-if="isEditing"
      ref="inputRef"
      v-model="editValue"
      type="text"
      :aria-invalid="isEditValueValid ? undefined : 'true'"
      class="tpl:w-32 tpl:rounded tpl:bg-transparent tpl:px-0.5 tpl:py-0 tpl:text-[1em] tpl:font-medium tpl:outline-none tpl:text-[var(--tpl-primary)]"
      :class="
        isEditValueValid
          ? 'tpl:border-none'
          : 'tpl:border tpl:border-[var(--tpl-danger)]'
      "
      @blur="finishEditing"
      @keydown="handleKeydown"
    />
    <!-- Display mode -->
    <span
      v-else
      role="button"
      tabindex="0"
      :aria-label="
        canRepick
          ? format(t.mergeTag.changeTag, { label: displayLabel })
          : t.mergeTag.editValue
      "
      class="tpl:cursor-pointer"
      :class="showRawValue ? 'tpl-tooltip' : ''"
      :data-tooltip="showRawValue ? node.attrs.value : undefined"
      @click.stop="activate"
      @keydown.enter.stop="activate"
      @keydown.space.prevent.stop="activate"
    >
      {{ displayLabel }}
    </span>
    <button
      type="button"
      :aria-label="t.mergeTag.deleteMergeTag"
      class="tpl-merge-tag-delete tpl:flex tpl:size-5 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-full tpl:border-none tpl:bg-transparent tpl:p-0 tpl:opacity-60 tpl:transition-all tpl:hover:opacity-100 tpl:text-[var(--tpl-primary)]"
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
