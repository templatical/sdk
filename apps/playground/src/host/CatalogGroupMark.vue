<script setup lang="ts">
import type { SceneGroup } from "@/scenes";

withDefaults(
  defineProps<{
    group: SceneGroup;
    /** `sm` is the rail's heading size; the glyph scales with it (style.css). */
    size?: "sm" | "md";
  }>(),
  { size: "md" },
);
</script>

<template>
  <span
    aria-hidden="true"
    class="pg-group-mark flex shrink-0 items-center justify-center"
    :class="size === 'sm' ? 'size-5 rounded' : 'size-8 rounded-md'"
    :data-group="group"
    :data-size="size"
  >
    <!-- Configure: swatches -->
    <svg
      v-if="group === 'configure'"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <rect x="1" y="4" width="6" height="8" rx="1" class="pg-mark-fill" />
      <rect x="9" y="2" width="6" height="8" rx="1" class="pg-mark-fill-2" />
    </svg>
    <!-- Personalization: merge-tag chip -->
    <svg
      v-else-if="group === 'personalization'"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <rect
        x="1.5"
        y="5"
        width="13"
        height="6"
        rx="2"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-dasharray="2 1.5"
        class="pg-mark-stroke"
      />
    </svg>
    <!-- Backend: stacked store -->
    <svg
      v-else-if="group === 'backend'"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <rect
        x="2"
        y="2"
        width="12"
        height="3.5"
        rx="0.75"
        class="pg-mark-fill"
      />
      <rect
        x="2"
        y="6.25"
        width="12"
        height="3.5"
        rx="0.75"
        class="pg-mark-fill-2"
      />
      <rect
        x="2"
        y="10.5"
        width="12"
        height="3.5"
        rx="0.75"
        class="pg-mark-fill"
      />
    </svg>
    <!-- Import: inbound document -->
    <svg
      v-else-if="group === 'import'"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M4 2.5h5.5L13 6v7.5H4V2.5Z"
        stroke="currentColor"
        stroke-width="1.25"
        class="pg-mark-stroke"
      />
      <path
        d="M9.5 2.5V6H13"
        stroke="currentColor"
        stroke-width="1.25"
        class="pg-mark-stroke"
      />
      <path
        d="M8 8v4M6 10.5 8 12l2-1.5"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
        class="pg-mark-stroke"
      />
    </svg>
    <!-- Examples: email bars -->
    <svg
      v-else-if="group === 'examples'"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <rect x="3" y="2" width="10" height="12" rx="1" class="pg-mark-fill-2" />
      <rect x="5" y="4" width="6" height="1.25" rx="0.4" class="pg-mark-fill" />
      <rect x="5" y="6.5" width="6" height="4" rx="0.4" class="pg-mark-fill" />
    </svg>
    <!-- Minimum: empty frame -->
    <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="2"
        y="3"
        width="12"
        height="10"
        rx="1"
        stroke="currentColor"
        stroke-width="1.25"
        class="pg-mark-stroke"
      />
    </svg>
  </span>
</template>
