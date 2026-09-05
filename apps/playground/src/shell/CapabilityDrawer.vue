<script setup lang="ts">
import { nextTick, onBeforeUnmount } from "vue";
import { ChevronDown, ChevronUp } from "@lucide/vue";
import {
  clampDrawerHeight,
  DRAWER_MAX_HEIGHT,
  DRAWER_MIN_HEIGHT,
} from "./drawer-chrome";

/**
 * The drawer's chrome: tab bar, collapse toggle, resize handle, and one
 * pane. Presentational only — the shell owns `activeTab`, `open` and
 * `height`, persisting the latter two under its own storage key; this
 * component renders the current values and asks for changes through its
 * emits. `activeTab` is session state and resets on reload.
 *
 * The tab bar always renders, in both the open and collapsed state — only
 * the pane (and the resize handle, which has nothing to resize while
 * collapsed) are conditional — so the drawer can always be reopened from
 * the toggle.
 */

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
  /** The live height, emitted continuously while a resize is in progress. */
  "update:height": [px: number];
  /**
   * The height a resize settled on. Separate from `update:height` so the
   * shell can persist once per gesture: a pointer drag emits the live value
   * on every `pointermove`, and writing each one puts a synchronous
   * `localStorage.setItem` on the gesture's frame budget.
   */
  "commit:height": [px: number];
}>();

function tabButtonId(id: string): string {
  return `capability-drawer-tab-${id}`;
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
  let height = startHeight;

  function onMove(moveEvent: PointerEvent): void {
    // The handle sits on the drawer's top edge: moving the pointer up (a
    // smaller clientY) grows the drawer, so the delta is inverted.
    height = clampDrawerHeight(startHeight + (startY - moveEvent.clientY));
    emit("update:height", height);
  }

  /**
   * One teardown for every way a gesture can end. `pointercancel` has to
   * route here too: the browser fires it instead of `pointerup` when it
   * takes the pointer away (a touch turning into a system gesture, a
   * device disconnect), and a teardown that only listens for `pointerup`
   * leaves the window listeners attached and `<body>` stuck at
   * `cursor: row-resize; user-select: none` for the rest of the session.
   */
  function endResize(): void {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endResize);
    window.removeEventListener("pointercancel", endResize);
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    stopResize = null;
    // One write per gesture, with whatever it settled on. A cancelled drag
    // still commits: the shell has been rendering `height` all along, so
    // leaving it unpersisted would make the drawer snap back on reload to a
    // size the user has not seen since the drag began.
    emit("commit:height", height);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", endResize);
  window.addEventListener("pointercancel", endResize);
  // Prevents the drag from selecting page text while the pointer crosses it.
  document.body.style.cursor = "row-resize";
  document.body.style.userSelect = "none";
  stopResize = endResize;
}

/**
 * Arrow Up/Down resize the same handle a pointer drag does — a pointer-only
 * handle is unreachable by keyboard. Each press is a whole gesture, so it
 * commits immediately; there is no stream of intermediate values to spare
 * the storage write.
 */
function onResizeKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    commitStep(props.height + RESIZE_STEP);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    commitStep(props.height - RESIZE_STEP);
  }
}

function commitStep(px: number): void {
  const height = clampDrawerHeight(px);
  emit("update:height", height);
  emit("commit:height", height);
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
