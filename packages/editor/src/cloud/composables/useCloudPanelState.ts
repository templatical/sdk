import { computed, ref, type ComputedRef, type Ref } from "vue";

type RightPanel = "comments";

export interface UseCloudPanelStateReturn {
  activePanel: Ref<RightPanel | null>;
  commentsOpen: ComputedRef<boolean> & { value: boolean };
  rightPanelOpen: ComputedRef<boolean>;
}

/**
 * Which of Cloud's right-hand panels is open. Only comments is left: the AI
 * panels are open-source now (`useAiFeature` owns their state, and keeps them
 * exclusive with comments through `commentsOpen`).
 */
export function useCloudPanelState(): UseCloudPanelStateReturn {
  const activePanel = ref<RightPanel | null>(null);

  const commentsOpen = computed({
    get: () => activePanel.value === "comments",
    set: (open) => (activePanel.value = open ? "comments" : null),
  });

  const rightPanelOpen = computed(() => activePanel.value !== null);

  return { activePanel, commentsOpen, rightPanelOpen };
}
