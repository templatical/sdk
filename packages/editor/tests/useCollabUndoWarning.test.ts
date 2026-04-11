import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { computed } from "vue";
import { useCollabUndoWarning } from "../src/cloud/composables/useCollabUndoWarning";

const mockStart = vi.fn();
vi.mock("@vueuse/core", () => ({
  useTimeoutFn: vi.fn(() => ({ start: mockStart })),
}));

function createOptions(overrides: {
  isCollaborationEnabled?: boolean;
  collaboratorCount?: number;
  canUndo?: boolean;
} = {}) {
  const {
    isCollaborationEnabled = true,
    collaboratorCount = 1,
    canUndo = true,
  } = overrides;

  return {
    isCollaborationEnabled: computed(() => isCollaborationEnabled),
    getCollaboratorCount: vi.fn(() => collaboratorCount),
    canUndo: computed(() => canUndo),
  };
}

describe("useCollabUndoWarning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collabUndoWarningVisible starts false", () => {
    const { collabUndoWarningVisible } = useCollabUndoWarning(createOptions());

    expect(collabUndoWarningVisible.value).toBe(false);
  });

  it("showCollabUndoWarning sets visible=true when all conditions met", () => {
    const { collabUndoWarningVisible, showCollabUndoWarning } =
      useCollabUndoWarning(
        createOptions({
          isCollaborationEnabled: true,
          collaboratorCount: 2,
          canUndo: true,
        }),
      );

    showCollabUndoWarning();

    expect(collabUndoWarningVisible.value).toBe(true);
  });

  it("does NOT show when collaboration disabled", () => {
    const { collabUndoWarningVisible, showCollabUndoWarning } =
      useCollabUndoWarning(
        createOptions({
          isCollaborationEnabled: false,
          collaboratorCount: 2,
          canUndo: true,
        }),
      );

    showCollabUndoWarning();

    expect(collabUndoWarningVisible.value).toBe(false);
  });

  it("does NOT show when no collaborators", () => {
    const { collabUndoWarningVisible, showCollabUndoWarning } =
      useCollabUndoWarning(
        createOptions({
          isCollaborationEnabled: true,
          collaboratorCount: 0,
          canUndo: true,
        }),
      );

    showCollabUndoWarning();

    expect(collabUndoWarningVisible.value).toBe(false);
  });

  it("does NOT show when canUndo is false", () => {
    const { collabUndoWarningVisible, showCollabUndoWarning } =
      useCollabUndoWarning(
        createOptions({
          isCollaborationEnabled: true,
          collaboratorCount: 2,
          canUndo: false,
        }),
      );

    showCollabUndoWarning();

    expect(collabUndoWarningVisible.value).toBe(false);
  });

  it("only fires once — second call is no-op even if conditions still met", () => {
    const { collabUndoWarningVisible, showCollabUndoWarning } =
      useCollabUndoWarning(
        createOptions({
          isCollaborationEnabled: true,
          collaboratorCount: 1,
          canUndo: true,
        }),
      );

    showCollabUndoWarning();
    expect(collabUndoWarningVisible.value).toBe(true);

    // Manually reset visible to simulate timeout clearing it
    collabUndoWarningVisible.value = false;

    showCollabUndoWarning();
    // Should NOT set it back to true since it already fired once
    expect(collabUndoWarningVisible.value).toBe(false);
  });

  it("calls startCollabUndoWarningTimeout when showing", () => {
    const { showCollabUndoWarning } = useCollabUndoWarning(
      createOptions({
        isCollaborationEnabled: true,
        collaboratorCount: 3,
        canUndo: true,
      }),
    );

    showCollabUndoWarning();

    expect(mockStart).toHaveBeenCalled();
  });

  it("does NOT call timeout when conditions not met", () => {
    const { showCollabUndoWarning } = useCollabUndoWarning(
      createOptions({
        isCollaborationEnabled: false,
        collaboratorCount: 0,
        canUndo: false,
      }),
    );

    showCollabUndoWarning();

    expect(mockStart).not.toHaveBeenCalled();
  });
});
