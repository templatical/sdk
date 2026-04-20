<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import type { Block, ViewportSize } from "@templatical/types";
import {
  Bookmark,
  Copy,
  EyeOff,
  Filter,
  GripVertical,
  MessageCircle,
  Trash2,
} from "@lucide/vue";
import { computed, inject, nextTick, ref } from "vue";
import { getBlockWrapperStyle } from "../../utils/blockComponentResolver";
import {
  BLOCK_ACTIONS_KEY,
  CONDITION_PREVIEW_KEY,
  CAPABILITIES_KEY,
  KEYBOARD_REORDER_KEY,
} from "../../keys";

const props = defineProps<{
  block: Block;
  isSelected: boolean;
  viewport?: ViewportSize;
  previewMode?: boolean;
}>();

const emit = defineEmits<{
  (e: "select"): void;
}>();

const { t, format } = useI18n();

const keyboardReorder = inject(KEYBOARD_REORDER_KEY, null);
const dragButtonRef = ref<HTMLButtonElement | null>(null);

const isLifted = computed(
  () => keyboardReorder?.liftedBlockId.value === props.block.id,
);

const dragAriaLabel = computed(() =>
  isLifted.value
    ? format(t.blockActions.dragLifted, {
        block: props.block.type,
      })
    : t.blockActions.drag,
);

async function refocusDragButton(): Promise<void> {
  await nextTick();
  dragButtonRef.value?.focus();
}

function handleDragKeydown(event: KeyboardEvent): void {
  if (!keyboardReorder) return;

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    if (isLifted.value) {
      keyboardReorder.drop(props.block.id);
    } else {
      keyboardReorder.lift(props.block.id);
    }
    return;
  }

  if (!isLifted.value) return;

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    keyboardReorder.cancel();
    refocusDragButton();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    event.stopPropagation();
    keyboardReorder.moveUp(props.block.id);
    refocusDragButton();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    event.stopPropagation();
    keyboardReorder.moveDown(props.block.id);
    refocusDragButton();
  }
}


const isHiddenOnViewport = computed(() => {
  if (!props.viewport || !props.block.visibility) {
    return false;
  }
  return props.block.visibility[props.viewport] === false;
});

const hiddenLabel = computed(() => {
  if (!props.viewport) {
    return "";
  }
  const labels: Record<string, string> = {
    desktop: t.viewport.desktop,
    tablet: t.viewport.tablet,
    mobile: t.viewport.mobile,
  };
  return labels[props.viewport] ?? props.viewport;
});

const hasDisplayCondition = computed(() => !!props.block.displayCondition);

const blockActions = inject(BLOCK_ACTIONS_KEY, null);
const conditionPreview = inject(CONDITION_PREVIEW_KEY, null);

const caps = inject(CAPABILITIES_KEY, {});

const canSaveAsModule = computed(() => !!caps.savedModules);

const blockCommentCount = computed(
  () => caps.comments?.getBlockCount(props.block.id) ?? 0,
);

const wrapperStyle = computed(() => getBlockWrapperStyle(props.block));

function handleClick(event: MouseEvent): void {
  if (props.previewMode) {
    return;
  }
  event.stopPropagation();
  emit("select");
}

function handleDelete(): void {
  blockActions?.deleteBlock(props.block.id);
}

function handleDuplicate(): void {
  blockActions?.duplicateBlock(props.block);
}

function handleSaveAsModule(): void {
  caps.savedModules?.openSaveDialog(props.block.id);
}

function handleConditionToggle(): void {
  conditionPreview?.toggleBlock(props.block.id);
}
</script>

<template>
  <div
    class="tpl-block tpl:group tpl:relative tpl:cursor-pointer tpl:rounded-sm tpl:transition-shadow tpl:duration-150"
    :class="{
      'tpl-block--selected': isSelected,
      'tpl-block--idle': !isSelected,
      'tpl-block--lifted': isLifted,
    }"
    :style="wrapperStyle"
    :data-block-id="block.id"
    :data-block-type="block.type"
    draggable="false"
    @click="handleClick"
  >
    <!-- Floating action bar — positioned to the right of selected block -->
    <div
      v-if="isSelected"
      role="toolbar"
      :aria-label="t.blockActions.drag"
      class="tpl-block-actions tpl-fade-in tpl:absolute tpl:-right-2 tpl:top-1/2 tpl:z-10 tpl:flex tpl:-translate-y-1/2 tpl:translate-x-full tpl:gap-0.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:p-1 tpl:bg-[var(--tpl-bg-elevated)] tpl:shadow-[var(--tpl-shadow-md)] tpl:border tpl:border-[var(--tpl-border)]"
    >
      <button
        ref="dragButtonRef"
        class="tpl-block-btn tpl-block-action-btn tpl:flex tpl:size-7 tpl:cursor-grab tpl:items-center tpl:justify-center tpl:rounded-sm tpl:border-none tpl:transition-colors tpl:duration-150 tpl:active:cursor-grabbing"
        :aria-label="dragAriaLabel"
        :aria-pressed="isLifted"
        aria-keyshortcuts="Space Enter ArrowUp ArrowDown Escape"
        :title="t.blockActions.drag"
        @keydown="handleDragKeydown"
      >
        <GripVertical :size="14" :stroke-width="1.5" />
      </button>
      <button
        class="tpl-block-action-btn tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-sm tpl:border-none tpl:transition-colors tpl:duration-150"
        :aria-label="t.blockActions.duplicate"
        :title="t.blockActions.duplicate"
        @click.stop="handleDuplicate"
      >
        <Copy :size="14" :stroke-width="1.5" />
      </button>
      <button
        v-if="canSaveAsModule"
        class="tpl-block-action-btn tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-sm tpl:border-none tpl:transition-colors tpl:duration-150"
        :aria-label="t.blockActions.saveAsModule"
        :title="t.blockActions.saveAsModule"
        @click.stop="handleSaveAsModule"
      >
        <Bookmark :size="14" :stroke-width="1.5" />
      </button>
      <button
        class="tpl-block-action-btn tpl-block-delete-btn tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-sm tpl:border-none tpl:transition-colors tpl:duration-150"
        :aria-label="t.blockActions.delete"
        :title="t.blockActions.delete"
        @click.stop="handleDelete"
      >
        <Trash2 :size="14" :stroke-width="1.5" />
      </button>
    </div>
    <div
      v-if="isHiddenOnViewport"
      class="tpl-block-hidden-overlay tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-[5] tpl:flex tpl:items-center tpl:justify-center tpl:rounded-sm"
    >
      <span
        class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-2 tpl:py-1 tpl:text-[10px] tpl:font-medium tpl:bg-[var(--tpl-bg-elevated)] tpl:text-[var(--tpl-text-muted)] tpl:shadow-[var(--tpl-shadow-sm)]"
      >
        <EyeOff :size="12" :stroke-width="1.5" />
        {{
          format(t.blockActions.hiddenOnViewport, {
            viewport: hiddenLabel,
          })
        }}
      </span>
    </div>
    <div
      v-if="hasDisplayCondition && !isHiddenOnViewport"
      class="tpl:absolute tpl:-left-1 tpl:top-1/2 tpl:z-[5] tpl:-translate-x-full tpl:-translate-y-1/2"
    >
      <button
        class="tpl-condition-toggle tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1 tpl:transition-colors tpl:duration-150 tpl:bg-[var(--tpl-bg-elevated)] tpl:text-[var(--tpl-primary)] tpl:border tpl:border-[var(--tpl-border)]"
        :aria-label="t.blockActions.conditionToggle"
        :title="block.displayCondition?.label"
        @click.stop="handleConditionToggle"
      >
        <Filter :size="12" :stroke-width="2" />
      </button>
    </div>
    <!-- Comment count indicator -->
    <div
      v-if="blockCommentCount > 0 && !isHiddenOnViewport"
      class="tpl:absolute tpl:-right-1 tpl:-top-1 tpl:z-[5] tpl:translate-x-full"
    >
      <button
        class="tpl-comment-indicator tpl:flex tpl:min-h-6 tpl:min-w-6 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-0.5 tpl:rounded-full tpl:border-none tpl:px-2 tpl:py-0.5 tpl:text-[10px] tpl:font-semibold tpl:transition-colors tpl:duration-150 tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary)]"
        :aria-label="
          format(t.blockActions.comments, { count: String(blockCommentCount) })
        "
        @click.stop="caps.comments?.openForBlock(block.id)"
      >
        <MessageCircle :size="12" :stroke-width="2.5" />
        {{ blockCommentCount }}
      </button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
/* Idle — subtle dashed outline so block boundaries are always visible */
.tpl-block--idle {
  outline: 1.5px dashed color-mix(in srgb, var(--tpl-primary) 30%, transparent);
  outline-offset: -1px;
  transition:
    outline 150ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Hover — solid outline, more prominent */
.tpl-block--idle:hover {
  outline: 1.5px solid color-mix(in srgb, var(--tpl-primary) 50%, transparent);
  outline-offset: -1px;
  box-shadow: 0 0 8px color-mix(in srgb, var(--tpl-primary) 8%, transparent);
}

/* Selection — solid outline + soft outer glow */
.tpl-block--selected {
  outline: 2px solid color-mix(in srgb, var(--tpl-primary) 60%, transparent);
  outline-offset: -1px;
  box-shadow: 0 0 12px color-mix(in srgb, var(--tpl-primary) 15%, transparent);
  transition:
    outline 150ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Action buttons — muted text, warm hover, press feedback */
.tpl-block-action-btn {
  color: var(--tpl-text-muted);
  background-color: transparent;
}

.tpl-block-action-btn:hover {
  background-color: var(--tpl-bg-hover);
  color: var(--tpl-text);
}

.tpl-block-action-btn:active {
  transform: scale(0.9);
}

.tpl-block-delete-btn:hover {
  background-color: var(--tpl-danger-light);
  color: var(--tpl-danger);
}

/* Condition toggle — interactive hover + press */
.tpl-condition-toggle:hover {
  background-color: var(--tpl-bg-hover) !important;
}

.tpl-condition-toggle:active {
  transform: scale(0.9);
}

/* Hidden block overlay — dims the block when hidden on current viewport */
.tpl-block-hidden-overlay {
  background-color: color-mix(in srgb, var(--tpl-bg) 60%, transparent);
}
</style>
