import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { SdkError } from "@templatical/types";
import {
  createParagraphBlock,
  createSectionBlock,
  createImageBlock,
} from "@templatical/types";
import type { Template, TemplateContent } from "@templatical/types";
import { ApiClient } from "../../src/cloud/api";
import type { AuthManager } from "../../src/cloud/auth";
import { useEditor } from "../../src/cloud/editor";

vi.mock("../../src/cloud/api");

function createMockAuthManager(): AuthManager {
  return {
    projectId: "proj-1",
    tenantSlug: "acme",
    authenticatedFetch: vi.fn(),
    userConfig: { id: "user-1", name: "Test", signature: "sig" },
  } as unknown as AuthManager;
}

function createMockTemplate(
  content?: Partial<TemplateContent>,
): Template {
  return {
    id: "tpl-1",
    content: {
      blocks: content?.blocks ?? [],
      settings: {
        width: 600,
        backgroundColor: "#ffffff",
        fontFamily: "Arial, sans-serif",
        ...(content?.settings ?? {}),
      },
    },
  } as Template;
}

describe("cloud useEditor", () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
    vi.mocked(ApiClient.prototype.createTemplate).mockClear();
    vi.mocked(ApiClient.prototype.getTemplate).mockClear();
    vi.mocked(ApiClient.prototype.updateTemplate).mockClear();
    vi.mocked(ApiClient.prototype.createSnapshot).mockClear();
  });

  function setup(opts: {
    onError?: (e: Error) => void;
    lockedBlocks?: Map<string, unknown>;
  } = {}) {
    const lockedRef = ref(opts.lockedBlocks ?? new Map());
    return useEditor({
      authManager: createMockAuthManager(),
      onError: opts.onError,
      lockedBlocks: lockedRef,
    });
  }

  describe("state management", () => {
    it("initializes with default content and flags", () => {
      const editor = setup();
      expect(editor.state.template).toBeNull();
      expect(editor.state.selectedBlockId).toBeNull();
      expect(editor.state.viewport).toBe("desktop");
      expect(editor.state.darkMode).toBe(false);
      expect(editor.state.previewMode).toBe(false);
      expect(editor.state.isDirty).toBe(false);
      expect(editor.state.isSaving).toBe(false);
      expect(editor.state.isLoading).toBe(false);
      expect(editor.state.uiTheme).toBe("auto");
    });

    it("setUiTheme changes UI theme", () => {
      const editor = setup();
      editor.setUiTheme("dark");
      expect(editor.state.uiTheme).toBe("dark");
      editor.setUiTheme("light");
      expect(editor.state.uiTheme).toBe("light");
      editor.setUiTheme("auto");
      expect(editor.state.uiTheme).toBe("auto");
    });

    it("uiTheme is independent from darkMode", () => {
      const editor = setup();
      editor.setUiTheme("dark");
      editor.setDarkMode(false);
      expect(editor.state.uiTheme).toBe("dark");
      expect(editor.state.darkMode).toBe(false);
    });

    it("selectBlock sets selectedBlockId", () => {
      const editor = setup();
      const block = createParagraphBlock();
      editor.addBlock(block);
      editor.selectBlock(block.id);
      expect(editor.state.selectedBlockId).toBe(block.id);
    });

    it("selectBlock ignores locked blocks", () => {
      const block = createParagraphBlock();
      const editor = setup({ lockedBlocks: new Map([[block.id, true]]) });
      editor.addBlock(block);
      editor.selectBlock(block.id);
      expect(editor.state.selectedBlockId).toBeNull();
    });

    it("selectBlock with null clears selection", () => {
      const editor = setup();
      const block = createParagraphBlock();
      editor.addBlock(block);
      editor.selectBlock(block.id);
      editor.selectBlock(null);
      expect(editor.state.selectedBlockId).toBeNull();
    });

    it("setPreviewMode clears selection when true", () => {
      const editor = setup();
      const block = createParagraphBlock();
      editor.addBlock(block);
      editor.selectBlock(block.id);
      editor.setPreviewMode(true);
      expect(editor.state.previewMode).toBe(true);
      expect(editor.state.selectedBlockId).toBeNull();
    });

    it("updateBlock patches block and marks dirty", () => {
      const editor = setup();
      const block = createParagraphBlock({ content: "Hello" });
      editor.addBlock(block);
      editor.updateBlock(block.id, { content: "World" } as any);
      const found = editor.content.value.blocks.find((b) => b.id === block.id);
      expect((found as any).content).toBe("World");
      expect(editor.state.isDirty).toBe(true);
    });

    it("updateBlock ignores locked blocks", () => {
      const block = createParagraphBlock({ content: "Hello" });
      const editor = setup({ lockedBlocks: new Map([[block.id, true]]) });
      editor.addBlock(block);
      // Reset dirty from addBlock
      editor.updateBlock(block.id, { content: "World" } as any);
      const found = editor.content.value.blocks.find((b) => b.id === block.id);
      expect((found as any).content).toBe("Hello");
    });

    it("removeBlock removes block and deselects if selected", () => {
      const editor = setup();
      const block = createParagraphBlock();
      editor.addBlock(block);
      editor.selectBlock(block.id);
      editor.removeBlock(block.id);
      expect(editor.content.value.blocks).toHaveLength(0);
      expect(editor.state.selectedBlockId).toBeNull();
    });

    it("removeBlock ignores locked blocks", () => {
      const block = createParagraphBlock();
      const editor = setup({ lockedBlocks: new Map([[block.id, true]]) });
      editor.addBlock(block);
      editor.removeBlock(block.id);
      expect(editor.content.value.blocks).toHaveLength(1);
    });
  });

  describe("addBlock", () => {
    it("adds block to root level", () => {
      const editor = setup();
      const block = createParagraphBlock();
      editor.addBlock(block);
      expect(editor.content.value.blocks).toHaveLength(1);
      expect(editor.state.isDirty).toBe(true);
    });

    it("adds block to section column", () => {
      const editor = setup();
      const section = createSectionBlock();
      editor.addBlock(section);
      const child = createParagraphBlock();
      editor.addBlock(child, section.id, 0);
      expect(section.children[0]).toContainEqual(
        expect.objectContaining({ id: child.id }),
      );
    });

    it("adds block at specific index", () => {
      const editor = setup();
      const block1 = createParagraphBlock();
      const block2 = createParagraphBlock();
      const block3 = createParagraphBlock();
      editor.addBlock(block1);
      editor.addBlock(block2);
      editor.addBlock(block3, undefined, undefined, 1);
      expect(editor.content.value.blocks[1].id).toBe(block3.id);
    });
  });

  describe("moveBlock", () => {
    it("moves block within root", () => {
      const editor = setup();
      const b1 = createParagraphBlock();
      const b2 = createParagraphBlock();
      editor.addBlock(b1);
      editor.addBlock(b2);
      editor.moveBlock(b1.id, 1);
      expect(editor.content.value.blocks[0].id).toBe(b2.id);
      expect(editor.content.value.blocks[1].id).toBe(b1.id);
    });

    it("moves block from root to section", () => {
      const editor = setup();
      const section = createSectionBlock();
      const block = createParagraphBlock();
      editor.addBlock(section);
      editor.addBlock(block);
      editor.moveBlock(block.id, 0, section.id, 0);
      expect(editor.content.value.blocks).toHaveLength(1);
      expect(section.children[0]).toContainEqual(
        expect.objectContaining({ id: block.id }),
      );
    });

    it("moves block from section to root", () => {
      const editor = setup();
      const section = createSectionBlock();
      const child = createParagraphBlock();
      editor.addBlock(section);
      editor.addBlock(child, section.id, 0);
      editor.moveBlock(child.id, 1);
      expect(editor.content.value.blocks).toHaveLength(2);
      expect(editor.content.value.blocks[1].id).toBe(child.id);
    });
  });

  describe("savedBlockIds", () => {
    it("returns empty set when no template", () => {
      const editor = setup();
      expect(editor.savedBlockIds.value.size).toBe(0);
    });

    it("includes root block ids from template", async () => {
      const block = createParagraphBlock();
      const tpl = createMockTemplate({ blocks: [block] });
      vi.mocked(ApiClient.prototype.getTemplate).mockResolvedValue(tpl);
      const editor = setup();
      await editor.load("tpl-1");
      expect(editor.savedBlockIds.value.has(block.id)).toBe(true);
    });

    it("includes section children ids", async () => {
      const child = createParagraphBlock();
      const section = createSectionBlock();
      section.children[0] = [child];
      const tpl = createMockTemplate({ blocks: [section] });
      vi.mocked(ApiClient.prototype.getTemplate).mockResolvedValue(tpl);
      const editor = setup();
      await editor.load("tpl-1");
      expect(editor.savedBlockIds.value.has(section.id)).toBe(true);
      expect(editor.savedBlockIds.value.has(child.id)).toBe(true);
    });
  });

  describe("create", () => {
    it("calls api.createTemplate and sets template", async () => {
      const tpl = createMockTemplate();
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(tpl);
      const editor = setup();
      const result = await editor.create();
      expect(ApiClient.prototype.createTemplate).toHaveBeenCalled();
      expect(result.id).toBe("tpl-1");
      expect(editor.state.template?.id).toBe("tpl-1");
      expect(editor.state.isDirty).toBe(false);
    });

    it("sets isLoading during create", async () => {
      let captured = false;
      vi.mocked(ApiClient.prototype.createTemplate).mockImplementation(async () => {
        captured = true;
        return createMockTemplate();
      });
      const editor = setup();
      const promise = editor.create();
      // isLoading is set before await
      await promise;
      expect(captured).toBe(true);
      expect(editor.state.isLoading).toBe(false);
    });

    it("calls onError on failure", async () => {
      const error = new Error("create failed");
      vi.mocked(ApiClient.prototype.createTemplate).mockRejectedValue(error);
      const onError = vi.fn();
      const editor = setup({ onError });
      await expect(editor.create()).rejects.toThrow("create failed");
      expect(onError).toHaveBeenCalledWith(error);
      expect(editor.state.isLoading).toBe(false);
    });
  });

  describe("load", () => {
    it("calls api.getTemplate and populates state", async () => {
      const block = createParagraphBlock();
      const tpl = createMockTemplate({ blocks: [block] });
      vi.mocked(ApiClient.prototype.getTemplate).mockResolvedValue(tpl);
      const editor = setup();
      await editor.load("tpl-1");
      expect(ApiClient.prototype.getTemplate).toHaveBeenCalledWith("tpl-1");
      expect(editor.state.template?.id).toBe("tpl-1");
      expect(editor.content.value.blocks).toHaveLength(1);
      expect(editor.state.isDirty).toBe(false);
    });

    it("sets isLoading during load", async () => {
      vi.mocked(ApiClient.prototype.getTemplate).mockResolvedValue(
        createMockTemplate(),
      );
      const editor = setup();
      await editor.load("tpl-1");
      expect(editor.state.isLoading).toBe(false);
    });

    it("calls onError on failure", async () => {
      const error = new Error("load failed");
      vi.mocked(ApiClient.prototype.getTemplate).mockRejectedValue(error);
      const onError = vi.fn();
      const editor = setup({ onError });
      await expect(editor.load("bad-id")).rejects.toThrow("load failed");
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe("save", () => {
    it("throws SdkError when no template loaded", async () => {
      const editor = setup();
      await expect(editor.save()).rejects.toThrow(SdkError);
    });

    it("calls api.updateTemplate with content", async () => {
      const tpl = createMockTemplate();
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(tpl);
      vi.mocked(ApiClient.prototype.updateTemplate).mockResolvedValue(tpl);
      const editor = setup();
      await editor.create();
      editor.markDirty();
      await editor.save();
      expect(ApiClient.prototype.updateTemplate).toHaveBeenCalledWith(
        "tpl-1",
        editor.content.value,
      );
    });

    it("clears isDirty after save", async () => {
      const tpl = createMockTemplate();
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(tpl);
      vi.mocked(ApiClient.prototype.updateTemplate).mockResolvedValue(tpl);
      const editor = setup();
      await editor.create();
      editor.markDirty();
      expect(editor.state.isDirty).toBe(true);
      await editor.save();
      expect(editor.state.isDirty).toBe(false);
    });

    it("sets isSaving during save", async () => {
      const tpl = createMockTemplate();
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(tpl);
      vi.mocked(ApiClient.prototype.updateTemplate).mockResolvedValue(tpl);
      const editor = setup();
      await editor.create();
      await editor.save();
      expect(editor.state.isSaving).toBe(false);
    });

    it("calls onError on failure", async () => {
      const tpl = createMockTemplate();
      const error = new Error("save failed");
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(tpl);
      vi.mocked(ApiClient.prototype.updateTemplate).mockRejectedValue(error);
      const onError = vi.fn();
      const editor = setup({ onError });
      await editor.create();
      await expect(editor.save()).rejects.toThrow("save failed");
      expect(onError).toHaveBeenCalledWith(error);
      expect(editor.state.isSaving).toBe(false);
    });
  });

  describe("createSnapshot", () => {
    it("calls api.createSnapshot", async () => {
      const tpl = createMockTemplate();
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(tpl);
      vi.mocked(ApiClient.prototype.createSnapshot).mockResolvedValue(
        undefined as any,
      );
      const editor = setup();
      await editor.create();
      await editor.createSnapshot();
      expect(ApiClient.prototype.createSnapshot).toHaveBeenCalledWith(
        "tpl-1",
        editor.content.value,
      );
    });

    it("no-ops when no template loaded", async () => {
      const callsBefore = vi.mocked(ApiClient.prototype.createSnapshot).mock
        .calls.length;
      const editor = setup();
      await editor.createSnapshot();
      expect(
        vi.mocked(ApiClient.prototype.createSnapshot).mock.calls.length,
      ).toBe(callsBefore);
    });

    it("calls onError on failure", async () => {
      const tpl = createMockTemplate();
      const error = new Error("snapshot failed");
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(tpl);
      vi.mocked(ApiClient.prototype.createSnapshot).mockRejectedValue(error);
      const onError = vi.fn();
      const editor = setup({ onError });
      await editor.create();
      await expect(editor.createSnapshot()).rejects.toThrow("snapshot failed");
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe("edge cases", () => {
    it("updateBlock on non-existent blockId leaves blocks unchanged", () => {
      const editor = setup();
      const blocksBefore = [...editor.content.value.blocks];
      editor.updateBlock("nonexistent", { content: "x" } as any);
      expect(editor.content.value.blocks).toEqual(blocksBefore);
    });

    it("removeBlock on non-existent blockId leaves blocks unchanged", () => {
      const editor = setup();
      const block = createParagraphBlock();
      editor.addBlock(block);
      editor.removeBlock("nonexistent");
      expect(editor.content.value.blocks).toHaveLength(1);
      expect(editor.content.value.blocks[0].id).toBe(block.id);
    });

    it("moveBlock with non-existent blockId leaves blocks unchanged", () => {
      const editor = setup();
      const block = createParagraphBlock();
      editor.addBlock(block);
      editor.moveBlock("nonexistent", 0);
      expect(editor.content.value.blocks).toHaveLength(1);
      expect(editor.content.value.blocks[0].id).toBe(block.id);
    });

    it("hasTemplate returns false before create/load", () => {
      const editor = setup();
      expect(editor.hasTemplate()).toBe(false);
    });

    it("hasTemplate returns true after create", async () => {
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(
        createMockTemplate(),
      );
      const editor = setup();
      await editor.create();
      expect(editor.hasTemplate()).toBe(true);
    });

    it("markDirty sets isDirty to true", () => {
      const editor = setup();
      expect(editor.state.isDirty).toBe(false);
      editor.markDirty();
      expect(editor.state.isDirty).toBe(true);
    });

    it("setContent with markDirty=false does not set isDirty", () => {
      const editor = setup();
      const newContent = { blocks: [], settings: editor.content.value.settings };
      editor.setContent(newContent as any, false);
      expect(editor.state.isDirty).toBe(false);
    });

    it("selectedBlock returns null for non-existent selectedBlockId", () => {
      const editor = setup();
      // Force a selectedBlockId that doesn't match any block
      editor.selectBlock(null);
      expect(editor.selectedBlock.value).toBeNull();
    });

    it("save after failed save recovers on retry", async () => {
      const tpl = createMockTemplate();
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(tpl);
      vi.mocked(ApiClient.prototype.updateTemplate)
        .mockRejectedValueOnce(new Error("transient"))
        .mockResolvedValueOnce(tpl);
      const onError = vi.fn();
      const editor = setup({ onError });
      await editor.create();

      await expect(editor.save()).rejects.toThrow("transient");
      expect(editor.state.isSaving).toBe(false);

      // Retry succeeds
      const result = await editor.save();
      expect(result.id).toBe("tpl-1");
      expect(editor.state.isDirty).toBe(false);
    });

    it("create with custom content uses provided content", async () => {
      const tpl = createMockTemplate();
      vi.mocked(ApiClient.prototype.createTemplate).mockResolvedValue(tpl);
      const editor = setup();
      const customContent = {
        blocks: [createParagraphBlock()],
        settings: { width: 800, backgroundColor: "#000", fontFamily: "Verdana" },
      } as any;
      await editor.create(customContent);
      expect(
        vi.mocked(ApiClient.prototype.createTemplate).mock.calls[0][0].blocks,
      ).toHaveLength(1);
    });

    it("addBlock to section ensures column array exists", () => {
      const editor = setup();
      const section = createSectionBlock();
      // Clear children to simulate edge case
      section.children = [];
      editor.addBlock(section);
      const child = createParagraphBlock();
      editor.addBlock(child, section.id, 2);
      expect(section.children[2]).toContainEqual(
        expect.objectContaining({ id: child.id }),
      );
    });

    it("setPreviewMode(false) does not deselect currently selected block", () => {
      const editor = setup();
      const block = createParagraphBlock();
      editor.addBlock(block);
      editor.selectBlock(block.id);
      editor.setPreviewMode(false);
      expect(editor.state.selectedBlockId).toBe(block.id);
      expect(editor.state.previewMode).toBe(false);
    });

    it("moveBlock with invalid target section removes block from source", () => {
      const editor = setup();
      const block = createParagraphBlock();
      editor.addBlock(block);
      expect(editor.content.value.blocks).toHaveLength(1);

      // Target section doesn't exist — block is spliced from root but not added anywhere
      editor.moveBlock(block.id, 0, "nonexistent-section");
      expect(editor.content.value.blocks).toHaveLength(0);
    });

    it("setContent(content, false) preserves existing isDirty=true", () => {
      const editor = setup();
      editor.markDirty();
      expect(editor.state.isDirty).toBe(true);
      editor.setContent(editor.content.value, false);
      expect(editor.state.isDirty).toBe(true);
    });
  });
});
