import { describe, expect, it, vi } from "vitest";
import { useHistoryInterceptor } from "../src/history-interceptor";
import type { UseEditorReturn } from "../src/editor";
import type { UseHistoryReturn } from "../src/history";

function createMockEditor(): UseEditorReturn {
  return {
    addBlock: vi.fn(),
    removeBlock: vi.fn(),
    moveBlock: vi.fn(),
    updateBlock: vi.fn(),
    updateSettings: vi.fn(),
  } as unknown as UseEditorReturn;
}

function createMockHistory(): UseHistoryReturn {
  return {
    record: vi.fn(),
    recordDebounced: vi.fn(),
  } as unknown as UseHistoryReturn;
}

describe("useHistoryInterceptor", () => {
  it("calls history.record() before editor.addBlock()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originalAddBlock = editor.addBlock;
    useHistoryInterceptor(editor, history);

    const callOrder: string[] = [];
    vi.mocked(history.record).mockImplementation(() => {
      callOrder.push("record");
    });
    (originalAddBlock as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("addBlock");
    });

    const block = { id: "b1", type: "title" } as Parameters<
      typeof editor.addBlock
    >[0];
    editor.addBlock(block, "section-1", 0, 2);

    expect(history.record).toHaveBeenCalledOnce();
    expect(originalAddBlock).toHaveBeenCalledWith(block, "section-1", 0, 2);
    expect(callOrder).toEqual(["record", "addBlock"]);
  });

  it("calls history.record() before editor.removeBlock()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    useHistoryInterceptor(editor, history);

    editor.removeBlock("block-1");

    expect(history.record).toHaveBeenCalledOnce();
  });

  it("calls history.record() before editor.moveBlock()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originalMoveBlock = editor.moveBlock;
    useHistoryInterceptor(editor, history);

    editor.moveBlock("block-1", 3, "section-2", 1);

    expect(history.record).toHaveBeenCalledOnce();
    expect(originalMoveBlock).toHaveBeenCalledWith(
      "block-1",
      3,
      "section-2",
      1,
    );
  });

  it("calls history.recordDebounced() for editor.updateBlock()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originalUpdateBlock = editor.updateBlock;
    useHistoryInterceptor(editor, history);

    editor.updateBlock("block-1", { content: "new" } as Parameters<
      typeof editor.updateBlock
    >[1]);

    expect(history.recordDebounced).toHaveBeenCalledWith("block-1");
    expect(history.record).not.toHaveBeenCalled();
    expect(originalUpdateBlock).toHaveBeenCalledWith("block-1", {
      content: "new",
    });
  });

  it("calls history.record() before editor.updateSettings()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originalUpdateSettings = editor.updateSettings;
    useHistoryInterceptor(editor, history);

    const updates = { backgroundColor: "#fff" } as Parameters<
      typeof editor.updateSettings
    >[0];
    editor.updateSettings(updates);

    expect(history.record).toHaveBeenCalledOnce();
    expect(originalUpdateSettings).toHaveBeenCalledWith(updates);
  });

  it("passes all arguments through to original methods", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originals = {
      addBlock: editor.addBlock,
      removeBlock: editor.removeBlock,
      moveBlock: editor.moveBlock,
      updateBlock: editor.updateBlock,
      updateSettings: editor.updateSettings,
    };

    useHistoryInterceptor(editor, history);

    const block = { id: "b1", type: "image" } as Parameters<
      typeof editor.addBlock
    >[0];
    editor.addBlock(block, "s1", 0, 5);
    expect(originals.addBlock).toHaveBeenCalledWith(block, "s1", 0, 5);

    editor.removeBlock("b2");
    expect(originals.removeBlock).toHaveBeenCalledWith("b2");

    editor.moveBlock("b3", 2, "s2", 1);
    expect(originals.moveBlock).toHaveBeenCalledWith("b3", 2, "s2", 1);

    editor.updateBlock("b4", { content: "x" } as Parameters<
      typeof editor.updateBlock
    >[1]);
    expect(originals.updateBlock).toHaveBeenCalledWith("b4", { content: "x" });

    const settings = { backgroundColor: "red" } as Parameters<
      typeof editor.updateSettings
    >[0];
    editor.updateSettings(settings);
    expect(originals.updateSettings).toHaveBeenCalledWith(settings);
  });
});
