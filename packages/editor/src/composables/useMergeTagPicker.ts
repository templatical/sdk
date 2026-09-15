import type { MergeTag } from "@templatical/types";
import { getCurrentScope, onScopeDispose, ref, type Ref } from "vue";

export interface UseMergeTagPickerReturn {
  /** Whether the picker modal is currently open. */
  isOpen: Ref<boolean>;
  /** The merge tags currently shown in the picker. */
  tags: Ref<MergeTag[]>;
  /**
   * The tag the user is replacing, when the picker was opened from an existing
   * tag rather than to insert a new one. Drives the modal's title and which
   * row starts highlighted. `null` for an insertion.
   */
  current: Ref<MergeTag | null>;
  /**
   * Open the picker with the given tags. Returns a promise that resolves
   * with the selected tag when the user clicks or presses Enter, or `null`
   * when the user cancels (Esc, Cancel button, backdrop click, or modal
   * teardown). If `open()` is called while another promise is pending, the
   * previous promise resolves with `null` (latest-wins) and a fresh one is
   * returned.
   *
   * Pass `options.current` to replace an existing tag: the modal then titles
   * itself as a change rather than an insert and preselects that row.
   */
  open: (
    tags: MergeTag[],
    options?: { current?: MergeTag },
  ) => Promise<MergeTag | null>;
  /**
   * Resolve the currently pending promise. Safe no-op when none is pending.
   * Closing the modal must always flow through this — direct `isOpen.value`
   * flips would leak the pending promise.
   */
  resolve: (tag: MergeTag | null) => void;
}

/**
 * Singleton state for the built-in merge tag picker modal. One instance
 * per editor (`useEditorCore` instantiates and provides it). The composable
 * holds a single pending resolver — concurrent `open()` calls supersede
 * the previous one (latest wins). On scope dispose, any in-flight promise
 * is resolved with `null` so callers awaiting the picker never leak.
 */
export function useMergeTagPicker(): UseMergeTagPickerReturn {
  const isOpen = ref(false);
  const tags = ref<MergeTag[]>([]);
  const current = ref<MergeTag | null>(null);

  let pendingResolver: ((tag: MergeTag | null) => void) | null = null;

  function open(
    nextTags: MergeTag[],
    options?: { current?: MergeTag },
  ): Promise<MergeTag | null> {
    // Latest-wins: a fresh open() call cancels the previous pending promise.
    if (pendingResolver) {
      const previous = pendingResolver;
      pendingResolver = null;
      previous(null);
    }
    tags.value = nextTags;
    current.value = options?.current ?? null;
    isOpen.value = true;
    return new Promise<MergeTag | null>((resolvePromise) => {
      pendingResolver = resolvePromise;
    });
  }

  function resolve(tag: MergeTag | null): void {
    const resolver = pendingResolver;
    pendingResolver = null;
    isOpen.value = false;
    tags.value = [];
    current.value = null;
    if (resolver) {
      resolver(tag);
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      // Dispose-while-open: caller awaiting the picker must not hang.
      if (pendingResolver) {
        const resolver = pendingResolver;
        pendingResolver = null;
        resolver(null);
      }
      isOpen.value = false;
      tags.value = [];
      current.value = null;
    });
  }

  return {
    isOpen,
    tags,
    current,
    open,
    resolve,
  };
}
