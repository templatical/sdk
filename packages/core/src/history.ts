import type { TemplateContent } from "@templatical/types";
import { computed, ref, type ComputedRef, type Ref } from "@vue/reactivity";

export interface UseHistoryOptions {
  content: Ref<TemplateContent>;
  setContent: (content: TemplateContent, markDirty?: boolean) => void;
  isRemoteOperation?: () => boolean;
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
}

interface DebouncedSnapshot {
  blockId: string;
  timeoutId: ReturnType<typeof setTimeout>;
}

const MAX_STACK_SIZE = 50;
const DEBOUNCE_MS = 300;
const NAVIGATE_IDLE_MS = 1500;

export function useHistory(options: UseHistoryOptions): UseHistoryReturn {
  const {
    content,
    setContent,
    isRemoteOperation,
    maxSize = MAX_STACK_SIZE,
  } = options;

  const undoStack = ref<TemplateContent[]>([]);
  const redoStack = ref<TemplateContent[]>([]);
  const isNavigating = ref(false);
  let navigatingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingDebounce: DebouncedSnapshot | null = null;

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  function cloneContent(): TemplateContent {
    // Cycle-safe deep clone. A naked JSON.stringify throws
    // `Converting circular structure to JSON` if anything in the tree
    // is self-referencing — e.g. a DOM element with a Sortable expando
    // back-ref ever sneaks into block data via a drag handler. We'd
    // rather drop the back-ref from the snapshot than freeze the undo
    // stack (the visible symptom: any subsequent mutation that calls
    // `record()` throws, breaking clone/move/etc.).
    const seen = new WeakSet<object>();
    return JSON.parse(
      JSON.stringify(content.value, (_key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return undefined;
          seen.add(value);
        }
        return value;
      }),
    ) as TemplateContent;
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
    if (isRemoteOperation?.()) {
      return;
    }

    flushPendingDebounce();
    pushToUndoStack(cloneContent());
    redoStack.value = [];
  }

  function recordDebounced(blockId: string): void {
    if (isRemoteOperation?.()) {
      return;
    }

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

  function undo(): void {
    if (undoStack.value.length === 0) {
      return;
    }

    flushPendingDebounce();

    const snapshot = undoStack.value.pop()!;
    redoStack.value.push(cloneContent());
    setContent(snapshot, true);
    setNavigating();
  }

  function redo(): void {
    if (redoStack.value.length === 0) {
      return;
    }

    flushPendingDebounce();

    const snapshot = redoStack.value.pop()!;
    undoStack.value.push(cloneContent());
    setContent(snapshot, true);
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
  };
}
