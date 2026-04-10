import { describe, expect, it, vi } from "vitest";
import { useCollaborationBroadcast } from "../../src/cloud/collaboration-broadcast";
import type { UseEditorReturn } from "../../src/editor";
import type { McpOperationPayload } from "@templatical/types";

function createMockEditor(): UseEditorReturn {
  return {
    addBlock: vi.fn(),
    removeBlock: vi.fn(),
    moveBlock: vi.fn(),
    updateBlock: vi.fn(),
    updateSettings: vi.fn(),
    setContent: vi.fn(),
  } as unknown as UseEditorReturn;
}

function createMockCollaboration() {
  return {
    _broadcastOperation: vi.fn(),
  };
}

describe("useCollaborationBroadcast", () => {
  it("calls original addBlock then broadcasts add_block operation", () => {
    const editor = createMockEditor();
    const collaboration = createMockCollaboration();
    const originalAddBlock = editor.addBlock;

    const callOrder: string[] = [];
    (originalAddBlock as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("original");
    });
    collaboration._broadcastOperation.mockImplementation(() => {
      callOrder.push("broadcast");
    });

    useCollaborationBroadcast(editor, collaboration);

    const block = { id: "b1", type: "title" } as Parameters<
      typeof editor.addBlock
    >[0];
    editor.addBlock(block, "section-1", 0);

    expect(originalAddBlock).toHaveBeenCalledWith(block, "section-1", 0);
    expect(callOrder).toEqual(["original", "broadcast"]);

    const payload: McpOperationPayload =
      collaboration._broadcastOperation.mock.calls[0][0];
    expect(payload.operation).toBe("add_block");
    expect(payload.data).toEqual({
      block,
      section_id: "section-1",
      column_index: 0,
    });
    expect(payload.timestamp).toBeGreaterThan(0);
  });

  it("broadcasts update_block operation with blockId and updates", () => {
    const editor = createMockEditor();
    const collaboration = createMockCollaboration();
    useCollaborationBroadcast(editor, collaboration);

    editor.updateBlock("b1", { content: "new" } as Parameters<
      typeof editor.updateBlock
    >[1]);

    const payload: McpOperationPayload =
      collaboration._broadcastOperation.mock.calls[0][0];
    expect(payload.operation).toBe("update_block");
    expect(payload.data).toEqual({
      block_id: "b1",
      updates: { content: "new" },
    });
  });

  it("broadcasts delete_block operation", () => {
    const editor = createMockEditor();
    const collaboration = createMockCollaboration();
    useCollaborationBroadcast(editor, collaboration);

    editor.removeBlock("b1");

    const payload: McpOperationPayload =
      collaboration._broadcastOperation.mock.calls[0][0];
    expect(payload.operation).toBe("delete_block");
    expect(payload.data).toEqual({ block_id: "b1" });
  });

  it("broadcasts move_block operation with all arguments", () => {
    const editor = createMockEditor();
    const collaboration = createMockCollaboration();
    useCollaborationBroadcast(editor, collaboration);

    editor.moveBlock("b1", 3, "section-2", 1);

    const payload: McpOperationPayload =
      collaboration._broadcastOperation.mock.calls[0][0];
    expect(payload.operation).toBe("move_block");
    expect(payload.data).toEqual({
      block_id: "b1",
      index: 3,
      section_id: "section-2",
      column_index: 1,
    });
  });

  it("broadcasts update_settings operation", () => {
    const editor = createMockEditor();
    const collaboration = createMockCollaboration();
    useCollaborationBroadcast(editor, collaboration);

    const updates = { backgroundColor: "#fff" } as Parameters<
      typeof editor.updateSettings
    >[0];
    editor.updateSettings(updates);

    const payload: McpOperationPayload =
      collaboration._broadcastOperation.mock.calls[0][0];
    expect(payload.operation).toBe("update_settings");
    expect(payload.data).toEqual({ updates });
  });

  it("broadcasts set_content operation", () => {
    const editor = createMockEditor();
    const collaboration = createMockCollaboration();
    useCollaborationBroadcast(editor, collaboration);

    const content = {
      blocks: [],
      settings: {},
    } as unknown as Parameters<typeof editor.setContent>[0];
    editor.setContent(content, true);

    const payload: McpOperationPayload =
      collaboration._broadcastOperation.mock.calls[0][0];
    expect(payload.operation).toBe("set_content");
    expect(payload.data).toEqual({ content });
  });

  it("executes original method before broadcasting for all methods", () => {
    const editor = createMockEditor();
    const collaboration = createMockCollaboration();
    const originals = {
      addBlock: editor.addBlock,
      updateBlock: editor.updateBlock,
      removeBlock: editor.removeBlock,
      moveBlock: editor.moveBlock,
      updateSettings: editor.updateSettings,
      setContent: editor.setContent,
    };

    useCollaborationBroadcast(editor, collaboration);

    // Verify each method calls original before broadcast
    for (const method of Object.keys(originals)) {
      const callOrder: string[] = [];
      const originalFn = originals[method as keyof typeof originals];
      (originalFn as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push("original");
      });
      collaboration._broadcastOperation.mockImplementation(() => {
        callOrder.push("broadcast");
      });

      // Call the wrapped method with minimal args
      if (method === "addBlock") {
        editor.addBlock({ id: "b", type: "title" } as Parameters<
          typeof editor.addBlock
        >[0]);
      } else if (method === "removeBlock") {
        editor.removeBlock("b");
      } else if (method === "moveBlock") {
        editor.moveBlock("b", 0);
      } else if (method === "updateBlock") {
        editor.updateBlock("b", {} as Parameters<typeof editor.updateBlock>[1]);
      } else if (method === "updateSettings") {
        editor.updateSettings(
          {} as Parameters<typeof editor.updateSettings>[0],
        );
      } else if (method === "setContent") {
        editor.setContent(
          {} as unknown as Parameters<typeof editor.setContent>[0],
        );
      }

      expect(callOrder).toEqual(["original", "broadcast"]);

      // Reset for next iteration
      vi.mocked(originalFn).mockReset();
      collaboration._broadcastOperation.mockReset();
    }
  });
});
