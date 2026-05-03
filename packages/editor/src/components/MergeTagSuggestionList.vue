<script setup lang="ts">
import type { MergeTag } from "@templatical/types";

const props = defineProps<{
  items: MergeTag[];
  selectedIndex: number;
  emptyText: string;
  /** Stable id used for aria-controls + per-option id derivation. */
  listId?: string;
}>();

defineEmits<{
  (e: "select", item: MergeTag): void;
  (e: "hover", index: number): void;
}>();

function optionId(index: number): string | undefined {
  return props.listId ? `${props.listId}-opt-${index}` : undefined;
}
</script>

<template>
  <div
    :id="listId"
    class="tpl:min-w-[200px] tpl:max-w-[320px] tpl:max-h-[50vh] tpl:overflow-y-auto tpl:rounded-[var(--tpl-radius-md)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)] tpl:py-1 tpl:shadow-lg"
    role="listbox"
    data-testid="merge-tag-suggestion-list"
  >
    <div
      v-if="items.length === 0"
      class="tpl:px-3 tpl:py-2 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
      data-testid="merge-tag-suggestion-empty"
    >
      {{ emptyText }}
    </div>
    <button
      v-for="(item, index) in items"
      :key="item.value"
      :id="optionId(index)"
      type="button"
      role="option"
      :aria-selected="index === selectedIndex"
      :data-selected="index === selectedIndex ? 'true' : 'false'"
      :data-merge-tag-value="item.value"
      class="tpl:flex tpl:w-full tpl:flex-col tpl:items-start tpl:gap-0.5 tpl:px-3 tpl:py-1.5 tpl:text-left tpl:text-xs tpl:transition-colors"
      :class="
        index === selectedIndex
          ? 'tpl:bg-[var(--tpl-primary-light)] tpl:text-[var(--tpl-primary)]'
          : 'tpl:text-[var(--tpl-text)] hover:tpl:bg-[var(--tpl-bg-hover)]'
      "
      @mousedown.prevent.stop="$emit('select', item)"
      @mousemove="index !== selectedIndex && $emit('hover', index)"
    >
      <span class="tpl:font-medium">{{ item.label }}</span>
      <span class="tpl:text-[var(--tpl-text-dim)] tpl:font-mono">{{
        item.value
      }}</span>
    </button>
  </div>
</template>
