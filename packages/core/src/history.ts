import {
  applyOperationsInPlace,
  deepEqual,
  safeClone,
  type TemplateContent,
} from "@templatical/types";
import { computed, ref, type ComputedRef, type Ref } from "@vue/reactivity";
import { diffContent } from "./diff-content";

export interface UseHistoryOptions {
  content: Ref<TemplateContent>;
  setContent: (content: TemplateContent, markDirty?: boolean) => void;
  /** Marks an in-place restore dirty; defaults to setContent(live, true). */
  markDirty?: () => void;
  maxSize?: number;
}

export interface UseHistoryReturn {
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;
  isNavigating: Ref<boolean>;
  undo: () => void;
  redo: () => void;
  record: () => void;
  recordDebounced: (blockId: string) => void;
  clear: () => void;
  destroy: () => void;
  flushDebounce?: () => void;
}

interface DebouncedSnapshot {
  blockId: string;
  timeoutId: ReturnType<typeof setTimeout>;
}

const MAX_STACK_SIZE = 50;
const DEBOUNCE_MS = 300;
const NAVIGATE_IDLE_MS = 1500;

// Each in-place write triggers every deep watcher (autosave, onChange) with a
// full traversal of the content, so restoring N changed blocks costs N
// traversals. Past a handful of operations one whole replace is cheaper: at
// 1,000 blocks a traversal is about 9 ms against roughly 90 ms of re-render for
// a replace, and an undo of 1,000 changed blocks took 9 s in place.
const MAX_IN_PLACE_OPERATIONS = 8;

export function useHistory(options: UseHistoryOptions): UseHistoryReturn {
  const { content, setContent, markDirty, maxSize = MAX_STACK_SIZE } = options;

  const undoStack = ref<TemplateContent[]>([]);
  const redoStack = ref<TemplateContent[]>([]);
  const isNavigating = ref(false);
  let navigatingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingDebounce: DebouncedSnapshot | null = null;

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  function cloneContent(): TemplateContent {
    // Cycle-safe deep clone (see `safeClone`). A naked JSON.stringify throws
    // `Converting circular structure to JSON` if a DOM element with a Sortable
    // expando back-ref ever sneaks into block data via a drag handler — which
    // would freeze the undo stack, since every subsequent mutation calls
    // `record()`. safeClone drops the back-ref instead of throwing.
    return safeClone(content.value);
  }

  function pushToUndoStack(snapshot: TemplateContent): void {
    undoStack.value.push(snapshot);
    if (undoStack.value.length > maxSize) {
      undoStack.value.splice(0, undoStack.value.length - maxSize);
    }
  }

  function flushPendingDebounce(): void {
    if (pendingDebounce) {
      clearTimeout(pendingDebounce.timeoutId);
      pendingDebounce = null;
    }
  }

  function record(): void {
    flushPendingDebounce();
    pushToUndoStack(cloneContent());
    redoStack.value = [];
  }

  function recordDebounced(blockId: string): void {
    if (pendingDebounce && pendingDebounce.blockId === blockId) {
      clearTimeout(pendingDebounce.timeoutId);
      pendingDebounce.timeoutId = setTimeout(() => {
        pendingDebounce = null;
      }, DEBOUNCE_MS);
      return;
    }

    flushPendingDebounce();

    pushToUndoStack(cloneContent());
    redoStack.value = [];

    pendingDebounce = {
      blockId,
      timeoutId: setTimeout(() => {
        pendingDebounce = null;
      }, DEBOUNCE_MS),
    };
  }

  function setNavigating(): void {
    isNavigating.value = true;
    if (navigatingTimeoutId) {
      clearTimeout(navigatingTimeoutId);
    }
    navigatingTimeoutId = setTimeout(() => {
      isNavigating.value = false;
      navigatingTimeoutId = null;
    }, NAVIGATE_IDLE_MS);
  }

  function applySnapshot(snapshot: TemplateContent): void {
    let applied = false;
    try {
      const live = content.value;
      const operations = diffContent(live, snapshot);
      if (operations.length <= MAX_IN_PLACE_OPERATIONS) {
        applyOperationsInPlace(live, operations);
        applied = deepEqual(live, snapshot);
      }
    } catch {
      // An operation may have changed live content before a later one failed.
    }
    if (!applied) {
      setContent(snapshot, true);
    } else if (markDirty) {
      markDirty();
    } else {
      // Existing headless callers supply only setContent for dirty tracking.
      setContent(content.value, true);
    }
  }

  function undo(): void {
    if (undoStack.value.length === 0) {
      return;
    }

    flushPendingDebounce();

    const snapshot = undoStack.value.pop()!;
    redoStack.value.push(cloneContent());
    applySnapshot(snapshot);
    setNavigating();
  }

  function redo(): void {
    if (redoStack.value.length === 0) {
      return;
    }

    flushPendingDebounce();

    const snapshot = redoStack.value.pop()!;
    undoStack.value.push(cloneContent());
    applySnapshot(snapshot);
    setNavigating();
  }

  function clear(): void {
    undoStack.value = [];
    redoStack.value = [];
    flushPendingDebounce();
  }

  function destroy(): void {
    clear();
    if (navigatingTimeoutId) {
      clearTimeout(navigatingTimeoutId);
      navigatingTimeoutId = null;
    }
  }

  return {
    canUndo,
    canRedo,
    isNavigating,
    undo,
    redo,
    record,
    recordDebounced,
    clear,
    destroy,
    flushDebounce: flushPendingDebounce,
  };
}
