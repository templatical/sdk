import { describe, expect, it, vi } from "vitest";
import {
  handleEditorKeydown,
  isEditingText,
  type KeyboardShortcutHandlers,
} from "../src/utils/keyboardShortcuts";

function createMockHandlers(
  overrides: Partial<KeyboardShortcutHandlers> = {},
): KeyboardShortcutHandlers {
  return {
    history: {
      undo: vi.fn(),
      redo: vi.fn(),
      record: vi.fn(),
      canUndo: { value: true },
      canRedo: { value: true },
    } as unknown as KeyboardShortcutHandlers["history"],
    selectBlock: vi.fn(),
    getSelectedBlockId: vi.fn().mockReturnValue(null),
    removeBlock: vi.fn(),
    onSave: vi.fn(),
    onBeforeUndo: vi.fn(),
    ...overrides,
  };
}

function createKeyEvent(
  key: string,
  options: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    targetTag?: string;
    contentEditable?: boolean;
  } = {},
): KeyboardEvent {
  const {
    metaKey = false,
    ctrlKey = false,
    shiftKey = false,
    targetTag = "DIV",
    contentEditable = false,
  } = options;

  let prevented = false;

  const target = {
    tagName: targetTag.toUpperCase(),
    isContentEditable: contentEditable,
  };

  return {
    key,
    metaKey,
    ctrlKey,
    shiftKey,
    target,
    preventDefault: () => {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  } as unknown as KeyboardEvent;
}

describe("isEditingText", () => {
  it("returns true for INPUT elements", () => {
    const e = createKeyEvent("z", { targetTag: "INPUT" });
    expect(isEditingText(e)).toBe(true);
  });

  it("returns true for TEXTAREA elements", () => {
    const e = createKeyEvent("z", { targetTag: "TEXTAREA" });
    expect(isEditingText(e)).toBe(true);
  });

  it("returns true for SELECT elements", () => {
    const e = createKeyEvent("z", { targetTag: "SELECT" });
    expect(isEditingText(e)).toBe(true);
  });

  it("returns true for contentEditable elements", () => {
    const e = createKeyEvent("z", { contentEditable: true });
    expect(isEditingText(e)).toBe(true);
  });

  it("returns false for regular DIV elements", () => {
    const e = createKeyEvent("z", { targetTag: "DIV" });
    expect(isEditingText(e)).toBe(false);
  });

  it("returns false for BUTTON elements", () => {
    const e = createKeyEvent("z", { targetTag: "BUTTON" });
    expect(isEditingText(e)).toBe(false);
  });
});

describe("handleEditorKeydown", () => {
  describe("Cmd/Ctrl+S: save", () => {
    it("calls onSave with metaKey", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("s", { metaKey: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.onSave).toHaveBeenCalledOnce();
      expect(e.defaultPrevented).toBe(true);
    });

    it("calls onSave with ctrlKey", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("s", { ctrlKey: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.onSave).toHaveBeenCalledOnce();
      expect(e.defaultPrevented).toBe(true);
    });

    it("does not call onSave without modifier", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("s");

      handleEditorKeydown(e, handlers);

      expect(handlers.onSave).not.toHaveBeenCalled();
    });

    it("calls onSave when caps lock is on (e.key is 'S')", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("S", { metaKey: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.onSave).toHaveBeenCalledOnce();
      expect(e.defaultPrevented).toBe(true);
    });
  });

  describe("Cmd/Ctrl+Z: undo", () => {
    it("calls history.undo with metaKey", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("z", { metaKey: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.history.undo).toHaveBeenCalledOnce();
      expect(e.defaultPrevented).toBe(true);
    });

    it("calls history.undo with ctrlKey", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("z", { ctrlKey: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.history.undo).toHaveBeenCalledOnce();
    });

    it("calls onBeforeUndo before undo", () => {
      const callOrder: string[] = [];
      const handlers = createMockHandlers({
        onBeforeUndo: vi.fn(() => callOrder.push("beforeUndo")),
        history: {
          undo: vi.fn(() => callOrder.push("undo")),
          redo: vi.fn(),
          record: vi.fn(),
        } as unknown as KeyboardShortcutHandlers["history"],
      });
      const e = createKeyEvent("z", { metaKey: true });

      handleEditorKeydown(e, handlers);

      expect(callOrder).toEqual(["beforeUndo", "undo"]);
    });

    it("skips undo when editing text (contentEditable)", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("z", { metaKey: true, contentEditable: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.history.undo).not.toHaveBeenCalled();
      expect(e.defaultPrevented).toBe(false);
    });

    it("skips undo when editing text (INPUT)", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("z", { metaKey: true, targetTag: "INPUT" });

      handleEditorKeydown(e, handlers);

      expect(handlers.history.undo).not.toHaveBeenCalled();
    });
  });

  describe("Cmd/Ctrl+Shift+Z: redo", () => {
    it("calls history.redo with metaKey+shiftKey", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("z", { metaKey: true, shiftKey: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.history.redo).toHaveBeenCalledOnce();
      expect(handlers.history.undo).not.toHaveBeenCalled();
      expect(e.defaultPrevented).toBe(true);
    });

    it("calls history.redo with ctrlKey+shiftKey", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("z", { ctrlKey: true, shiftKey: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.history.redo).toHaveBeenCalledOnce();
    });

    it("does not call onBeforeUndo for redo", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("z", { metaKey: true, shiftKey: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.onBeforeUndo).not.toHaveBeenCalled();
    });

    it("skips redo when editing text", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("z", {
        metaKey: true,
        shiftKey: true,
        contentEditable: true,
      });

      handleEditorKeydown(e, handlers);

      expect(handlers.history.redo).not.toHaveBeenCalled();
    });
  });

  describe("Escape: deselect", () => {
    it("calls selectBlock(null) on Escape", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("Escape");

      handleEditorKeydown(e, handlers);

      expect(handlers.selectBlock).toHaveBeenCalledWith(null);
    });

    it("does not prevent default on Escape", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("Escape");

      handleEditorKeydown(e, handlers);

      expect(e.defaultPrevented).toBe(false);
    });
  });

  describe("Delete/Backspace: remove block", () => {
    it("removes selected block on Delete", () => {
      const handlers = createMockHandlers({
        getSelectedBlockId: vi.fn().mockReturnValue("block-1"),
      });
      const e = createKeyEvent("Delete");

      handleEditorKeydown(e, handlers);

      expect(handlers.history.record).toHaveBeenCalledOnce();
      expect(handlers.removeBlock).toHaveBeenCalledWith("block-1");
      expect(e.defaultPrevented).toBe(true);
    });

    it("removes selected block on Backspace", () => {
      const handlers = createMockHandlers({
        getSelectedBlockId: vi.fn().mockReturnValue("block-2"),
      });
      const e = createKeyEvent("Backspace");

      handleEditorKeydown(e, handlers);

      expect(handlers.removeBlock).toHaveBeenCalledWith("block-2");
    });

    it("does nothing when no block is selected", () => {
      const handlers = createMockHandlers({
        getSelectedBlockId: vi.fn().mockReturnValue(null),
      });
      const e = createKeyEvent("Delete");

      handleEditorKeydown(e, handlers);

      expect(handlers.removeBlock).not.toHaveBeenCalled();
    });

    it("does nothing when editing text (INPUT)", () => {
      const handlers = createMockHandlers({
        getSelectedBlockId: vi.fn().mockReturnValue("block-1"),
      });
      const e = createKeyEvent("Delete", { targetTag: "INPUT" });

      handleEditorKeydown(e, handlers);

      expect(handlers.removeBlock).not.toHaveBeenCalled();
    });

    it("does nothing when editing text (contentEditable / TipTap)", () => {
      const handlers = createMockHandlers({
        getSelectedBlockId: vi.fn().mockReturnValue("block-1"),
      });
      const e = createKeyEvent("Backspace", { contentEditable: true });

      handleEditorKeydown(e, handlers);

      expect(handlers.removeBlock).not.toHaveBeenCalled();
    });
  });

  describe("permissive modifier", () => {
    it("accepts both metaKey and ctrlKey for the same action", () => {
      const handlers1 = createMockHandlers();
      const handlers2 = createMockHandlers();

      handleEditorKeydown(createKeyEvent("z", { metaKey: true }), handlers1);
      handleEditorKeydown(createKeyEvent("z", { ctrlKey: true }), handlers2);

      expect(handlers1.history.undo).toHaveBeenCalledOnce();
      expect(handlers2.history.undo).toHaveBeenCalledOnce();
    });
  });

  describe("unrelated keys", () => {
    it("does nothing for regular key presses", () => {
      const handlers = createMockHandlers();
      const e = createKeyEvent("a");

      handleEditorKeydown(e, handlers);

      expect(handlers.history.undo).not.toHaveBeenCalled();
      expect(handlers.history.redo).not.toHaveBeenCalled();
      expect(handlers.onSave).not.toHaveBeenCalled();
      expect(handlers.selectBlock).not.toHaveBeenCalled();
      expect(handlers.removeBlock).not.toHaveBeenCalled();
    });
  });
});

