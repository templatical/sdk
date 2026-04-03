<script setup lang="ts">
import type {
  UseBlockActionsReturn,
  UseConditionPreviewReturn,
} from "@templatical/core";
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
import { computed, inject } from "vue";

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

const blockActions = inject<UseBlockActionsReturn>("blockActions");
const conditionPreview = inject<UseConditionPreviewReturn>("conditionPreview");

// Cloud-only injects — null in OSS mode

const commentsInstance = inject<any>("comments", null);
const openCommentsForBlock = inject<(blockId: string) => void>(
  "openCommentsForBlock",
  undefined as never,
);

const savedModulesVisual = inject<any>("savedModules", null);

const planConfig = inject<any>("planConfig", null);

const canSaveAsModule = computed(
  () => !!savedModulesVisual && !!planConfig?.hasFeature("saved_modules"),
);

const blockCommentCount = computed(() => {
  if (!commentsInstance) {
    return 0;
  }
  return commentsInstance.commentCountByBlock.value.get(props.block.id) ?? 0;
});

const wrapperStyle = computed(() => {
  const { padding, margin, backgroundColor } = props.block.styles;
  return {
    padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
    margin: `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`,
    backgroundColor: backgroundColor || "transparent",
  };
});

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
  savedModulesVisual?.openSaveDialog(props.block.id);
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
      class="tpl-block-actions tpl-fade-in tpl:absolute tpl:-right-2 tpl:top-1/2 tpl:z-10 tpl:flex tpl:-translate-y-1/2 tpl:translate-x-full tpl:gap-0.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:p-1"
      style="
        background-color: var(--tpl-bg-elevated);
        box-shadow: var(--tpl-shadow-md);
        border: 1px solid var(--tpl-border);
      "
    >
      <button
        class="tpl-block-btn tpl-block-action-btn tpl:flex tpl:size-7 tpl:cursor-grab tpl:items-center tpl:justify-center tpl:rounded-sm tpl:border-none tpl:transition-colors tpl:duration-150 tpl:active:cursor-grabbing"
        :aria-label="t.blockActions.drag"
        :title="t.blockActions.drag"
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
        class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-2 tpl:py-1 tpl:text-[10px] tpl:font-medium"
        style="
          background-color: var(--tpl-bg-elevated);
          color: var(--tpl-text-muted);
          box-shadow: var(--tpl-shadow-sm);
        "
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
        class="tpl-condition-toggle tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1 tpl:transition-colors tpl:duration-150"
        style="
          background-color: var(--tpl-bg-elevated);
          color: var(--tpl-primary);
          border: 1px solid var(--tpl-border);
        "
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
        class="tpl-comment-indicator tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-0.5 tpl:rounded-full tpl:border-none tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-semibold tpl:transition-colors tpl:duration-150"
        style="
          background-color: var(--tpl-primary-light);
          color: var(--tpl-primary);
        "
        :aria-label="
          format(t.blockActions.comments, { count: String(blockCommentCount) })
        "
        @click.stop="openCommentsForBlock?.(block.id)"
      >
        <MessageCircle :size="10" :stroke-width="2.5" />
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
