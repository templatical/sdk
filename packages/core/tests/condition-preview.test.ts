import { describe, expect, it, vi } from "vitest";
import { useConditionPreview } from "../src/condition-preview";

function createMockEditor(selectedBlockId: string | null = null) {
  return {
    state: { selectedBlockId },
    selectBlock: vi.fn((id: string | null) => {
      editor.state.selectedBlockId = id;
    }),
  } as unknown as Parameters<typeof useConditionPreview>[0];

  var editor: ReturnType<typeof createMockEditor>;
}

function setup(selectedBlockId: string | null = null) {
  const editor = {
    state: { selectedBlockId },
    selectBlock: vi.fn((id: string | null) => {
      editor.state.selectedBlockId = id;
    }),
  } as unknown as Parameters<typeof useConditionPreview>[0];
  const preview = useConditionPreview(editor);
  return { editor, preview };
}

describe("useConditionPreview", () => {
  it("starts with no hidden blocks", () => {
    const { preview } = setup();
    expect(preview.hasHiddenBlocks.value).toBe(false);
  });

  it("isHidden returns false for unhidden block", () => {
    const { preview } = setup();
    expect(preview.isHidden("block-1")).toBe(false);
  });

  it("toggleBlock hides a block", () => {
    const { preview } = setup();
    preview.toggleBlock("block-1");
    expect(preview.isHidden("block-1")).toBe(true);
    expect(preview.hasHiddenBlocks.value).toBe(true);
  });

  it("double toggle restores visibility", () => {
    const { preview } = setup();
    preview.toggleBlock("block-1");
    preview.toggleBlock("block-1");
    expect(preview.isHidden("block-1")).toBe(false);
    expect(preview.hasHiddenBlocks.value).toBe(false);
  });

  it("hasHiddenBlocks is true when blocks are hidden", () => {
    const { preview } = setup();
    preview.toggleBlock("block-1");
    preview.toggleBlock("block-2");
    expect(preview.hasHiddenBlocks.value).toBe(true);
  });

  it("toggleBlock deselects the block if it was selected", () => {
    const { editor, preview } = setup("block-1");
    preview.toggleBlock("block-1");
    expect(editor.selectBlock).toHaveBeenCalledWith(null);
  });

  it("toggleBlock does not deselect if a different block is selected", () => {
    const { editor, preview } = setup("block-2");
    preview.toggleBlock("block-1");
    expect(editor.selectBlock).not.toHaveBeenCalled();
  });

  it("reset clears all hidden blocks", () => {
    const { preview } = setup();
    preview.toggleBlock("block-1");
    preview.toggleBlock("block-2");
    preview.reset();
    expect(preview.isHidden("block-1")).toBe(false);
    expect(preview.isHidden("block-2")).toBe(false);
    expect(preview.hasHiddenBlocks.value).toBe(false);
  });

  it("reset when empty keeps hasHiddenBlocks false", () => {
    const { preview } = setup();
    preview.reset();
    expect(preview.hasHiddenBlocks.value).toBe(false);
    expect(preview.isHidden("any-id")).toBe(false);
  });

  it("hasHiddenBlocks updates reactively after toggle", () => {
    const { preview } = setup();
    expect(preview.hasHiddenBlocks.value).toBe(false);
    preview.toggleBlock("block-1");
    expect(preview.hasHiddenBlocks.value).toBe(true);
    preview.toggleBlock("block-1");
    expect(preview.hasHiddenBlocks.value).toBe(false);
  });

  describe("edge cases", () => {
    it("toggling non-existent block id still hides it", () => {
      const { preview } = setup();
      preview.toggleBlock("nonexistent-id");
      expect(preview.isHidden("nonexistent-id")).toBe(true);
      expect(preview.hasHiddenBlocks.value).toBe(true);
    });

    it("hiding one block does not affect others", () => {
      const { preview } = setup();
      preview.toggleBlock("block-1");
      preview.toggleBlock("block-2");
      preview.toggleBlock("block-1"); // unhide block-1
      expect(preview.isHidden("block-1")).toBe(false);
      expect(preview.isHidden("block-2")).toBe(true);
    });

    it("unhiding a block does not call selectBlock", () => {
      const { editor, preview } = setup("block-1");
      preview.toggleBlock("block-1"); // hide — calls selectBlock(null)
      expect(editor.selectBlock).toHaveBeenCalledTimes(1);
      preview.toggleBlock("block-1"); // unhide — should NOT call selectBlock
      expect(editor.selectBlock).toHaveBeenCalledTimes(1);
    });

    it("reset after hiding many blocks clears all", () => {
      const { preview } = setup();
      for (let i = 0; i < 50; i++) {
        preview.toggleBlock(`block-${i}`);
      }
      expect(preview.hasHiddenBlocks.value).toBe(true);
      preview.reset();
      expect(preview.hasHiddenBlocks.value).toBe(false);
      for (let i = 0; i < 50; i++) {
        expect(preview.isHidden(`block-${i}`)).toBe(false);
      }
    });
  });
});
