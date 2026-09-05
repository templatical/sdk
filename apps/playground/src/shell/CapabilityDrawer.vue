<script setup lang="ts">
import { nextTick, onBeforeUnmount } from "vue";
import { ChevronDown, ChevronUp } from "@lucide/vue";

/**
 * The drawer's chrome: tab bar, collapse toggle, resize handle, and one
 * pane. Presentational only — the shell owns `activeTab`/`open`/`height`
 * (and persists them); this component renders the current values and asks
 * for changes through its emits.
 *
 * The tab bar always renders, in both the open and collapsed state — only
 * the pane (and the resize handle, which has nothing to resize while
 * collapsed) are conditional — so the drawer can always be reopened from
 * the toggle.
 */

/**
 * Clamp bounds for `height`, in pixels. `min` fits a couple of control rows
 * (label + help line) before the pane needs to scroll, so collapsing isn't
 * the only way to see more than one row. `max` leaves the editor above it a
 * usable slice of a typical viewport (e.g. ~200px at a 720px-tall window)
 * rather than letting the drawer squeeze it away entirely.
 */
const DRAWER_MIN_HEIGHT = 160;
const DRAWER_MAX_HEIGHT = 480;

/** Arrow-key resize increment, in pixels. */
const RESIZE_STEP = 16;

/** The one pane element every tab's `aria-controls` points at. */
const PANE_ID = "capability-drawer-pane";

const props = defineProps<{
  tabs: { id: string; label: string }[];
  activeTab: string;
  open: boolean;
  height: number;
}>();

const emit = defineEmits<{
  "update:activeTab": [id: string];
  "update:open": [open: boolean];
  "update:height": [px: number];
}>();

function tabButtonId(id: string): string {
  return `capability-drawer-tab-${id}`;
}

function clampHeight(px: number): number {
  return Math.min(DRAWER_MAX_HEIGHT, Math.max(DRAWER_MIN_HEIGHT, px));
}

/**
 * Roving focus across the tablist, mirroring `App.vue`'s `focusExportTab` —
 * the export modal's tabs are the same single-panel shape as this drawer's,
 * so the two should behave alike.
 */
function focusTab(delta: number): void {
  const ids = props.tabs.map((tab) => tab.id);
  const index = ids.indexOf(props.activeTab);
  const next = ids[(index + delta + ids.length) % ids.length];
  emit("update:activeTab", next);
  void nextTick(() => {
    document.getElementById(tabButtonId(next))?.focus();
  });
}

// Pointer-driven resize. Listeners live on `window` rather than the handle
// itself so the drag keeps tracking once the pointer leaves the handle's
// thin hit area — a resize gesture routinely does.
let stopResize: (() => void) | null = null;

function onResizePointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  // Suppresses the browser's own default action for the gesture (which
  // includes focusing the handle), so a starting drag never selects page
  // text. Focus the handle back explicitly — a mouse user who just dragged
  // it should be able to follow up with Arrow Up/Down without a separate Tab.
  event.preventDefault();
  (event.currentTarget as HTMLElement | null)?.focus();
  const startY = event.clientY;
  const startHeight = props.height;

  function onMove(moveEvent: PointerEvent): void {
    // The handle sits on the drawer's top edge: moving the pointer up (a
    // smaller clientY) grows the drawer, so the delta is inverted.
    emit(
      "update:height",
      clampHeight(startHeight + (startY - moveEvent.clientY)),
    );
  }
  function onUp(): void {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    stopResize = null;
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  // Prevents the drag from selecting page text while the pointer crosses it.
  document.body.style.cursor = "row-resize";
  document.body.style.userSelect = "none";
  stopResize = onUp;
}

/** Arrow Up/Down resize the same handle a pointer drag does — a pointer-only handle is unreachable by keyboard. */
function onResizeKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    emit("update:height", clampHeight(props.height + RESIZE_STEP));
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    emit("update:height", clampHeight(props.height - RESIZE_STEP));
  }
}

onBeforeUnmount(() => {
  stopResize?.();
});
</script>

<template>
  <section
    data-testid="capability-drawer"
    aria-label="Capability drawer"
    class="flex shrink-0 flex-col border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    :style="open ? { height: `${height}px` } : undefined"
  >
    <div
      v-if="open"
      data-testid="capability-drawer-resize"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize drawer"
      :aria-valuenow="height"
      :aria-valuemin="DRAWER_MIN_HEIGHT"
      :aria-valuemax="DRAWER_MAX_HEIGHT"
      tabindex="0"
      class="h-1.5 shrink-0 cursor-row-resize touch-none bg-transparent transition-colors duration-150 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:hover:bg-gray-700"
      @pointerdown="onResizePointerDown"
      @keydown="onResizeKeydown"
    />

    <div class="flex shrink-0 items-center justify-between gap-2 px-2 py-1.5">
      <div
        role="tablist"
        aria-label="Drawer sections"
        class="flex items-center gap-1"
        @keydown.arrow-right.prevent="focusTab(1)"
        @keydown.arrow-left.prevent="focusTab(-1)"
      >
        <button
          v-for="tab in tabs"
          :id="tabButtonId(tab.id)"
          :key="tab.id"
          type="button"
          role="tab"
          data-testid="capability-drawer-tab"
          :aria-selected="tab.id === activeTab"
          :aria-controls="PANE_ID"
          :tabindex="tab.id === activeTab ? 0 : -1"
          class="pg-tab"
          :class="tab.id === activeTab ? 'pg-tab-active' : 'pg-tab-inactive'"
          @click="emit('update:activeTab', tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <button
        type="button"
        data-testid="capability-drawer-toggle"
        :aria-expanded="open"
        :aria-label="open ? 'Collapse drawer' : 'Expand drawer'"
        class="pg-theme-btn"
        @click="emit('update:open', !open)"
      >
        <ChevronDown
          v-if="open"
          :size="14"
          :stroke-width="1.5"
          aria-hidden="true"
        />
        <ChevronUp v-else :size="14" :stroke-width="1.5" aria-hidden="true" />
      </button>
    </div>

    <div
      v-show="open"
      :id="PANE_ID"
      data-testid="capability-drawer-pane"
      role="tabpanel"
      :aria-labelledby="tabButtonId(activeTab)"
      class="min-h-0 flex-1 overflow-y-auto border-t border-gray-100 dark:border-gray-700"
    >
      <slot />
    </div>
  </section>
</template>
