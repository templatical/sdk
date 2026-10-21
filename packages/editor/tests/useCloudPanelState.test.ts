import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { useCloudPanelState } from "../src/cloud/composables/useCloudPanelState";

describe("useCloudPanelState", () => {
  it("activePanel starts as null", () => {
    const { activePanel } = useCloudPanelState();

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

    activePanel.value = "comments";
    expect(rightPanelOpen.value).toBe(true);

    activePanel.value = null;
    expect(rightPanelOpen.value).toBe(false);
  });

  /* `testEmailModalOpen` used to live here. The test-email dialog's open state
     moved into `useTestEmailFeature` when the feature became shared with the OSS
     editor — panel state is for Cloud-only surfaces. */

  it("knows only the comments panel", () => {
    const state = useCloudPanelState();

    state.commentsOpen.value = true;
    expect(state.activePanel.value).toBe("comments");
    expect(state.rightPanelOpen.value).toBe(true);

    state.commentsOpen.value = false;
    expect(state.activePanel.value).toBe(null);
    expect(Object.keys(state).sort()).toEqual([
      "activePanel",
      "commentsOpen",
      "rightPanelOpen",
    ]);
  });
});
