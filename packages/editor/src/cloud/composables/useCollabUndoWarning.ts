import { ref, type ComputedRef, type Ref } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import { COLLAB_UNDO_WARNING_MS } from "../../constants/timeouts";

export interface UseCollabUndoWarningOptions {
  /** Whether collaboration is currently enabled (reactive). */
  isCollaborationEnabled: ComputedRef<boolean>;
  /** Returns the current list of collaborators. */
  getCollaboratorCount: () => number;
  /** Whether the history stack has entries to undo. */
  canUndo: ComputedRef<boolean>;
}

export interface UseCollabUndoWarningReturn {
  collabUndoWarningVisible: Ref<boolean>;
  showCollabUndoWarning: () => void;
}

export function useCollabUndoWarning(
  options: UseCollabUndoWarningOptions,
): UseCollabUndoWarningReturn {
  const { isCollaborationEnabled, getCollaboratorCount, canUndo } = options;

  let collabUndoWarningFired = false;
  const collabUndoWarningVisible = ref(false);

  const { start: startCollabUndoWarningTimeout } = useTimeoutFn(
    () => {
      collabUndoWarningVisible.value = false;
    },
    COLLAB_UNDO_WARNING_MS,
    { immediate: false },
  );

  function showCollabUndoWarning(): void {
    if (
      collabUndoWarningFired ||
      !isCollaborationEnabled.value ||
      getCollaboratorCount() === 0 ||
      !canUndo.value
    ) {
      return;
    }

    collabUndoWarningFired = true;
    collabUndoWarningVisible.value = true;
    startCollabUndoWarningTimeout();
  }

  return {
    collabUndoWarningVisible,
    showCollabUndoWarning,
  };
}
