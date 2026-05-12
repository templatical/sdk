import { describe, expect, it } from "vitest";
import { isNodeSelected } from "../src/extensions/isNodeSelected";
import type { Editor } from "@tiptap/core";

function createMockEditor(options: {
  fromPos: number;
  toPos: number;
  nodeBeforeType?: string | null;
  nodeAfterType?: string | null;
}): Editor {
  const $from = {
    pos: options.fromPos,
    nodeBefore: options.nodeBeforeType
      ? { type: { name: options.nodeBeforeType } }
      : null,
    nodeAfter: options.nodeAfterType
      ? { type: { name: options.nodeAfterType } }
      : null,
  };

  const $to = { pos: options.toPos };

  return {
    state: {
      selection: { $from, $to },
    },
  } as unknown as Editor;
}

describe("isNodeSelected", () => {
  // Regression: previously returned `true` whenever `nodesBetween` found
  // any merge-tag node in the selection range — silently broke
  // Cmd+A + Backspace for any paragraph containing a merge tag (entire
  // deletion was cancelled, nothing happened). Range selections must
  // fall through to default replaceSelection behavior.
  it("returns false for range selections even when they span the target node", () => {
    const editor = createMockEditor({
      fromPos: 0,
      toPos: 10,
    });
    expect(isNodeSelected(editor, "mergeTagNode")).toBe(false);
  });

  it("returns false for range selections regardless of adjacent nodes", () => {
    // Range with cursor-adjacent target: range still wins, returns false.
    const editor = createMockEditor({
      fromPos: 0,
      toPos: 5,
      nodeBeforeType: "mergeTagNode",
      nodeAfterType: "mergeTagNode",
    });
    expect(isNodeSelected(editor, "mergeTagNode")).toBe(false);
  });

  it("returns true when cursor is right after the target node (Backspace)", () => {
    const editor = createMockEditor({
      fromPos: 3,
      toPos: 3,
      nodeBeforeType: "logicMergeTagNode",
    });
    expect(isNodeSelected(editor, "logicMergeTagNode")).toBe(true);
  });

  it("returns true when cursor is right before the target node (Delete)", () => {
    const editor = createMockEditor({
      fromPos: 3,
      toPos: 3,
      nodeAfterType: "mergeTagNode",
    });
    expect(isNodeSelected(editor, "mergeTagNode")).toBe(true);
  });

  it("returns false when cursor is in plain text with no adjacent atom", () => {
    const editor = createMockEditor({
      fromPos: 7,
      toPos: 7,
    });
    expect(isNodeSelected(editor, "mergeTagNode")).toBe(false);
  });

  it("returns false when cursor is at position 0 with no adjacent atom", () => {
    const editor = createMockEditor({
      fromPos: 0,
      toPos: 0,
    });
    expect(isNodeSelected(editor, "mergeTagNode")).toBe(false);
  });

  it("does not check nodeBefore when cursor is at position 0", () => {
    // Edge case: at doc start, `nodeBefore` may be undefined in ProseMirror.
    // The pos > 0 guard prevents a spurious match.
    const editor = createMockEditor({
      fromPos: 0,
      toPos: 0,
      nodeBeforeType: "mergeTagNode",
    });
    expect(isNodeSelected(editor, "mergeTagNode")).toBe(false);
  });

  it("returns false when adjacent node is a different type", () => {
    const editor = createMockEditor({
      fromPos: 3,
      toPos: 3,
      nodeBeforeType: "paragraph",
    });
    expect(isNodeSelected(editor, "mergeTagNode")).toBe(false);
  });

  it("works for both merge tag node types with the same function", () => {
    const mergeEditor = createMockEditor({
      fromPos: 5,
      toPos: 5,
      nodeAfterType: "mergeTagNode",
    });
    const logicEditor = createMockEditor({
      fromPos: 5,
      toPos: 5,
      nodeAfterType: "logicMergeTagNode",
    });

    expect(isNodeSelected(mergeEditor, "mergeTagNode")).toBe(true);
    expect(isNodeSelected(logicEditor, "logicMergeTagNode")).toBe(true);
    expect(isNodeSelected(mergeEditor, "logicMergeTagNode")).toBe(false);
    expect(isNodeSelected(logicEditor, "mergeTagNode")).toBe(false);
  });
});
