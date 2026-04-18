import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useCloudPanelState } from "../src/cloud/composables/useCloudPanelState";

vi.mock("@vueuse/core", () => ({
  onClickOutside: vi.fn(),
}));

describe("useCloudPanelState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activePanel starts as null", () => {
    const { activePanel } = useCloudPanelState();

    expect(activePanel.value).toBe(null);
  });

  it("aiChatOpen getter returns true when activePanel is 'ai-chat'", () => {
    const { activePanel, aiChatOpen } = useCloudPanelState();

    expect(aiChatOpen.value).toBe(false);

    activePanel.value = "ai-chat";
    expect(aiChatOpen.value).toBe(true);
  });

  it("aiChatOpen setter sets activePanel to 'ai-chat'", () => {
    const { activePanel, aiChatOpen } = useCloudPanelState();

    aiChatOpen.value = true;
    expect(activePanel.value).toBe("ai-chat");

    aiChatOpen.value = false;
    expect(activePanel.value).toBe(null);
  });

  it("scoringPanelOpen getter/setter works correctly", () => {
    const { activePanel, scoringPanelOpen } = useCloudPanelState();

    expect(scoringPanelOpen.value).toBe(false);

    scoringPanelOpen.value = true;
    expect(activePanel.value).toBe("scoring");
    expect(scoringPanelOpen.value).toBe(true);

    scoringPanelOpen.value = false;
    expect(activePanel.value).toBe(null);
  });

  it("designReferenceOpen getter/setter works correctly", () => {
    const { activePanel, designReferenceOpen } = useCloudPanelState();

    expect(designReferenceOpen.value).toBe(false);

    designReferenceOpen.value = true;
    expect(activePanel.value).toBe("design-reference");
    expect(designReferenceOpen.value).toBe(true);

    designReferenceOpen.value = false;
    expect(activePanel.value).toBe(null);
  });

  it("commentsOpen getter/setter works correctly", () => {
    const { activePanel, commentsOpen } = useCloudPanelState();

    expect(commentsOpen.value).toBe(false);

    commentsOpen.value = true;
    expect(activePanel.value).toBe("comments");
    expect(commentsOpen.value).toBe(true);

    commentsOpen.value = false;
    expect(activePanel.value).toBe(null);
  });

  it("rightPanelOpen is true when any panel active", () => {
    const { activePanel, rightPanelOpen } = useCloudPanelState();

    expect(rightPanelOpen.value).toBe(false);

    activePanel.value = "ai-chat";
    expect(rightPanelOpen.value).toBe(true);

    activePanel.value = "comments";
    expect(rightPanelOpen.value).toBe(true);

    activePanel.value = null;
    expect(rightPanelOpen.value).toBe(false);
  });

  it("toggleAiMenu toggles aiMenuOpen", () => {
    const { aiMenuOpen, toggleAiMenu } = useCloudPanelState();

    expect(aiMenuOpen.value).toBe(false);

    toggleAiMenu();
    expect(aiMenuOpen.value).toBe(true);

    toggleAiMenu();
    expect(aiMenuOpen.value).toBe(false);
  });

  it("handleAiFeatureSelect opens panel and closes ai menu", () => {
    const { activePanel, aiMenuOpen, handleAiFeatureSelect } =
      useCloudPanelState();

    aiMenuOpen.value = true;

    handleAiFeatureSelect("ai-chat");

    expect(aiMenuOpen.value).toBe(false);
    expect(activePanel.value).toBe("ai-chat");
  });

  it("handleAiFeatureSelect toggles off if same feature selected", () => {
    const { activePanel, handleAiFeatureSelect } = useCloudPanelState();

    handleAiFeatureSelect("scoring");
    expect(activePanel.value).toBe("scoring");

    handleAiFeatureSelect("scoring");
    expect(activePanel.value).toBe(null);
  });

  it("handleAiFeatureSelect switches to a different feature", () => {
    const { activePanel, handleAiFeatureSelect } = useCloudPanelState();

    handleAiFeatureSelect("ai-chat");
    expect(activePanel.value).toBe("ai-chat");

    handleAiFeatureSelect("design-reference");
    expect(activePanel.value).toBe("design-reference");
  });

  it("aiButtonActive is true when ai menu open", () => {
    const { aiMenuOpen, aiButtonActive } = useCloudPanelState();

    expect(aiButtonActive.value).toBe(false);

    aiMenuOpen.value = true;
    expect(aiButtonActive.value).toBe(true);
  });

  it("aiButtonActive is true when ai-related panel active", () => {
    const { activePanel, aiButtonActive } = useCloudPanelState();

    activePanel.value = "ai-chat";
    expect(aiButtonActive.value).toBe(true);

    activePanel.value = "scoring";
    expect(aiButtonActive.value).toBe(true);

    activePanel.value = "design-reference";
    expect(aiButtonActive.value).toBe(true);
  });

  it("aiButtonActive is false when non-ai panel active", () => {
    const { activePanel, aiButtonActive } = useCloudPanelState();

    activePanel.value = "comments";
    expect(aiButtonActive.value).toBe(false);
  });

  it("activeAiFeature maps ai-chat to 'ai-chat'", () => {
    const { activePanel, activeAiFeature } = useCloudPanelState();

    activePanel.value = "ai-chat";
    expect(activeAiFeature.value).toBe("ai-chat");
  });

  it("activeAiFeature maps scoring to 'scoring'", () => {
    const { activePanel, activeAiFeature } = useCloudPanelState();

    activePanel.value = "scoring";
    expect(activeAiFeature.value).toBe("scoring");
  });

  it("activeAiFeature maps design-reference to 'design-reference'", () => {
    const { activePanel, activeAiFeature } = useCloudPanelState();

    activePanel.value = "design-reference";
    expect(activeAiFeature.value).toBe("design-reference");
  });

  it("activeAiFeature returns null for comments panel", () => {
    const { activePanel, activeAiFeature } = useCloudPanelState();

    activePanel.value = "comments";
    expect(activeAiFeature.value).toBe(null);
  });

  it("activeAiFeature returns null when no panel active", () => {
    const { activeAiFeature } = useCloudPanelState();

    expect(activeAiFeature.value).toBe(null);
  });

  it("testEmailModalOpen starts as false", () => {
    const { testEmailModalOpen } = useCloudPanelState();

    expect(testEmailModalOpen.value).toBe(false);
  });

  it("mediaLibraryOpen starts as false", () => {
    const { mediaLibraryOpen } = useCloudPanelState();

    expect(mediaLibraryOpen.value).toBe(false);
  });

  it("mediaLibraryAccept starts as undefined", () => {
    const { mediaLibraryAccept } = useCloudPanelState();

    expect(mediaLibraryAccept.value).toBe(undefined);
  });

  it("setting one panel closes the previous one", () => {
    const { aiChatOpen, scoringPanelOpen, commentsOpen } =
      useCloudPanelState();

    aiChatOpen.value = true;
    expect(aiChatOpen.value).toBe(true);

    scoringPanelOpen.value = true;
    expect(aiChatOpen.value).toBe(false);
    expect(scoringPanelOpen.value).toBe(true);

    commentsOpen.value = true;
    expect(scoringPanelOpen.value).toBe(false);
    expect(commentsOpen.value).toBe(true);
  });
});
