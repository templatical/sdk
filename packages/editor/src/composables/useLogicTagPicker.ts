import type { LogicPair, LogicTag } from "@templatical/types";
import { getCurrentScope, onScopeDispose, ref, type Ref } from "vue";

/** A logic picker selection: a standalone tag or a paired construct. */
export type LogicTagPickerResult = LogicTag | LogicPair;

export interface UseLogicTagPickerReturn {
  /** Whether the picker modal is currently open. */
  isOpen: Ref<boolean>;
  /** Standalone logic tags shown in the picker's main list. */
  tags: Ref<LogicTag[]>;
  /** Paired constructs shown in the picker's "Blocks" section. */
  pairs: Ref<LogicPair[]>;
  /**
   * Open the picker with the given tags + pairs. Resolves with the selected
   * tag/pair on click or Enter, or `null` on cancel (Esc, backdrop, teardown).
   * A fresh `open()` while one is pending resolves the previous with `null`
   * (latest-wins).
   */
  open: (
    tags: LogicTag[],
    pairs: LogicPair[],
  ) => Promise<LogicTagPickerResult | null>;
  /**
   * Resolve the currently pending promise. Safe no-op when none is pending.
   * Closing the modal must always flow through this so the pending promise
   * never leaks.
   */
  resolve: (item: LogicTagPickerResult | null) => void;
}

/**
 * Singleton state for the built-in logic picker modal. One instance per editor
 * (`useEditorCore` instantiates and provides it). Holds a single pending
 * resolver — concurrent `open()` calls supersede the previous one (latest
 * wins). On scope dispose, any in-flight promise resolves with `null`.
 */
export function useLogicTagPicker(): UseLogicTagPickerReturn {
  const isOpen = ref(false);
  const tags = ref<LogicTag[]>([]);
  const pairs = ref<LogicPair[]>([]);

  let pendingResolver: ((item: LogicTagPickerResult | null) => void) | null =
    null;

  function open(
    nextTags: LogicTag[],
    nextPairs: LogicPair[],
  ): Promise<LogicTagPickerResult | null> {
    if (pendingResolver) {
      const previous = pendingResolver;
      pendingResolver = null;
      previous(null);
    }
    tags.value = nextTags;
    pairs.value = nextPairs;
    isOpen.value = true;
    return new Promise<LogicTagPickerResult | null>((resolvePromise) => {
      pendingResolver = resolvePromise;
    });
  }

  function resolve(item: LogicTagPickerResult | null): void {
    const resolver = pendingResolver;
    pendingResolver = null;
    isOpen.value = false;
    tags.value = [];
    pairs.value = [];
    if (resolver) {
      resolver(item);
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (pendingResolver) {
        const resolver = pendingResolver;
        pendingResolver = null;
        resolver(null);
      }
      isOpen.value = false;
      tags.value = [];
      pairs.value = [];
    });
  }

  return {
    isOpen,
    tags,
    pairs,
    open,
    resolve,
  };
}
