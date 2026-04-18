import { computed, ref, type ComputedRef, type Ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import type { AiFeature } from "../components/AiFeatureMenu.vue";
import type { MediaCategory } from "@templatical/media-library";

export interface UseCloudPanelStateReturn {
  activePanel: Ref<RightPanel | null>;
  aiChatOpen: ComputedRef<boolean> & { value: boolean };
  scoringPanelOpen: ComputedRef<boolean> & { value: boolean };
  designReferenceOpen: ComputedRef<boolean> & { value: boolean };
  commentsOpen: ComputedRef<boolean> & { value: boolean };
  testEmailModalOpen: Ref<boolean>;
  mediaLibraryOpen: Ref<boolean>;
  mediaLibraryAccept: Ref<MediaCategory[] | undefined>;
  aiMenuOpen: Ref<boolean>;
  aiMenuRef: Ref<HTMLElement | null>;
  rightPanelOpen: ComputedRef<boolean>;
  activeAiFeature: ComputedRef<AiFeature | null>;
  aiButtonActive: ComputedRef<boolean>;
  toggleAiMenu: () => void;
  handleAiFeatureSelect: (feature: AiFeature) => void;
}

type RightPanel = "ai-chat" | "scoring" | "design-reference" | "comments";

export function useCloudPanelState(): UseCloudPanelStateReturn {
  const activePanel = ref<RightPanel | null>(null);

  const aiChatOpen = computed({
    get: () => activePanel.value === "ai-chat",
    set: (v) => (activePanel.value = v ? "ai-chat" : null),
  });
  const scoringPanelOpen = computed({
    get: () => activePanel.value === "scoring",
    set: (v) => (activePanel.value = v ? "scoring" : null),
  });
  const designReferenceOpen = computed({
    get: () => activePanel.value === "design-reference",
    set: (v) => (activePanel.value = v ? "design-reference" : null),
  });
  const commentsOpen = computed({
    get: () => activePanel.value === "comments",
    set: (v) => (activePanel.value = v ? "comments" : null),
  });

  const testEmailModalOpen = ref(false);
  const mediaLibraryOpen = ref(false);
  const mediaLibraryAccept = ref<MediaCategory[] | undefined>(undefined);
  const aiMenuOpen = ref(false);
  const aiMenuRef = ref<HTMLElement | null>(null);

  const rightPanelOpen = computed(() => activePanel.value !== null);

  const activeAiFeature = computed<AiFeature | null>(() => {
    const p = activePanel.value;
    if (p === "ai-chat" || p === "design-reference" || p === "scoring")
      return p;
    return null;
  });

  const aiButtonActive = computed(
    () =>
      aiMenuOpen.value ||
      activePanel.value === "ai-chat" ||
      activePanel.value === "design-reference" ||
      activePanel.value === "scoring",
  );

  function toggleAiMenu(): void {
    aiMenuOpen.value = !aiMenuOpen.value;
  }

  function handleAiFeatureSelect(feature: AiFeature): void {
    aiMenuOpen.value = false;
    activePanel.value = activePanel.value === feature ? null : feature;
  }

  onClickOutside(aiMenuRef, () => {
    aiMenuOpen.value = false;
  });

  return {
    activePanel,
    aiChatOpen,
    scoringPanelOpen,
    designReferenceOpen,
    commentsOpen,
    testEmailModalOpen,
    mediaLibraryOpen,
    mediaLibraryAccept,
    aiMenuOpen,
    aiMenuRef,
    rightPanelOpen,
    activeAiFeature,
    aiButtonActive,
    toggleAiMenu,
    handleAiFeatureSelect,
  };
}
