// DOM stubs must be imported BEFORE anything that triggers an `HTMLElement`
// reference (the production code's composedPath traversal uses `instanceof
// HTMLElement`). Stub matches the editor's existing test convention.
import "./dom-stubs";
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

/**
 * Build a fake HTMLElement-shaped object the production code's
 * `instanceof HTMLElement` check accepts in jsdom/happy-dom.
 */
function makeFakeElement(tag: string, contentEditable: boolean): HTMLElement {
  const el = Object.create(HTMLElement.prototype) as HTMLElement;
  Object.defineProperty(el, "tagName", { value: tag.toUpperCase() });
  Object.defineProperty(el, "isContentEditable", {
    value: contentEditable,
  });
  return el;
}

function createKeyEvent(
  key: string,
  options: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    targetTag?: string;
    contentEditable?: boolean;
    /**
     * Models shadow-DOM event retargeting: `event.target` points to an
     * outer host element (e.g. the editor's container `<div>`), but
     * `event.composedPath()` still includes the real innermost target
     * inside the shadow tree. When provided, the test's logical
     * "inside-shadow target" goes here; the outer event.target is set
     * to a generic DIV — simulating what a document-level listener sees
     * when a key fires inside a shadow-mounted contenteditable.
     */
    innerTargetTag?: string;
    innerContentEditable?: boolean;
  } = {},
): KeyboardEvent {
  const {
    metaKey = false,
    ctrlKey = false,
    shiftKey = false,
    targetTag = "DIV",
    contentEditable = false,
    innerTargetTag,
    innerContentEditable = false,
  } = options;

  let prevented = false;

  const target = makeFakeElement(targetTag, contentEditable);

  // Build the composed path: innermost element first, then up through
  // the host (retargeted target), then document. Matches the real
  // event.composedPath() ordering.
  const path: EventTarget[] = innerTargetTag
    ? [
        makeFakeElement(innerTargetTag, innerContentEditable),
        target,
      ]
    : [target];

  return {
    key,
    metaKey,
    ctrlKey,
    shiftKey,
    target,
    composedPath: () => path,
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

  // Regression: when the editor mounts inside a shadow root, document-level
  // keydown listeners receive the event with `e.target` retargeted to the
  // shadow host (a regular DIV, not contentEditable). The actual editing
  // surface is only visible via `e.composedPath()`. Before the fix, the
  // shortcut handler thought the user was NOT editing text — Backspace
  // mid-typing deleted the entire block, etc.
  it("returns true when only composedPath exposes the contentEditable (shadow retargeting)", () => {
    const e = createKeyEvent("Backspace", {
      // Retargeted outer event.target — what the document listener "sees".
      targetTag: "DIV",
      contentEditable: false,
      // What's actually being edited inside the shadow tree.
      innerTargetTag: "DIV",
      innerContentEditable: true,
    });
    expect(isEditingText(e)).toBe(true);
  });

  it("returns true when only composedPath exposes an INPUT (shadow retargeting)", () => {
    const e = createKeyEvent("Backspace", {
      targetTag: "DIV",
      contentEditable: false,
      innerTargetTag: "INPUT",
    });
    expect(isEditingText(e)).toBe(true);
  });

  it("returns false when neither target nor composed path contains an editing surface", () => {
    const e = createKeyEvent("Backspace", {
      targetTag: "DIV",
      innerTargetTag: "BUTTON",
    });
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

describe("useEditorCore keydown wiring", () => {
  // Source-level guard: the editor's global keydown listener attaches at
  // `document` level so it catches keystrokes regardless of where the
  // user's focus is (non-focusable blocks keep activeElement on
  // document.body, so a shadow-root-scoped listener would miss those).
  // Multi-instance keydown scoping is a future concern handled at the
  // handler level, not at the listener target.
  it("source attaches keydown listener to document", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      "src/composables/useEditorCore.ts",
      "utf8",
    );
    expect(src).toMatch(/useEventListener\(document,\s*["']keydown["']/);
  });
});

