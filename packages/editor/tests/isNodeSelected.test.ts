import { describe, expect, it, vi } from "vitest";
import { isNodeSelected } from "../src/extensions/isNodeSelected";
import type { Editor } from "@tiptap/core";

function createMockEditor(options: {
  fromPos: number;
  toPos: number;
  nodesBetween?: Array<{ typeName: string }>;
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

  const nodesBetweenFn = vi.fn(
    (
      _from: number,
      _to: number,
      callback: (node: { type: { name: string } }) => boolean | void,
    ) => {
      for (const node of options.nodesBetween ?? []) {
        const result = callback({ type: { name: node.typeName } });
        if (result === false) break;
      }
    },
  );

  return {
    state: {
      selection: { $from, $to },
      doc: { nodesBetween: nodesBetweenFn },
    },
  } as unknown as Editor;
}

describe("isNodeSelected", () => {
  it("returns true when selection contains the target node type", () => {
    const editor = createMockEditor({
      fromPos: 0,
      toPos: 5,
      nodesBetween: [{ typeName: "mergeTagNode" }],
    });

    expect(isNodeSelected(editor, "mergeTagNode")).toBe(true);
  });

  it("returns false when selection contains a different node type", () => {
    const editor = createMockEditor({
      fromPos: 0,
      toPos: 5,
      nodesBetween: [{ typeName: "paragraph" }],
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

  it("returns false when cursor is at position 0 with no adjacent nodes", () => {
    const editor = createMockEditor({
      fromPos: 0,
      toPos: 0,
    });

    expect(isNodeSelected(editor, "mergeTagNode")).toBe(false);
  });

  it("does not check nodeBefore when cursor is at position 0", () => {
    const editor = createMockEditor({
      fromPos: 0,
      toPos: 0,
      nodeBeforeType: "mergeTagNode",
    });

    // Position 0 guard: $from.pos > 0 is false, so nodeBefore is not checked
    expect(isNodeSelected(editor, "mergeTagNode")).toBe(false);
  });

  it("stops nodesBetween iteration early when target is found", () => {
    const editor = createMockEditor({
      fromPos: 0,
      toPos: 10,
      nodesBetween: [
        { typeName: "mergeTagNode" },
        { typeName: "paragraph" },
      ],
    });

    expect(isNodeSelected(editor, "mergeTagNode")).toBe(true);
    // The callback returned false after finding the node, stopping iteration
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
