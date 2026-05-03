import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { shallowRef } from "vue";

vi.mock("../src/composables/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

import { useRichTextLinkDialog } from "../src/composables/useRichTextLinkDialog";

function createMockEditor(existingHref = "") {
  const chainResult = {
    focus: vi.fn().mockReturnThis(),
    extendMarkRange: vi.fn().mockReturnThis(),
    setLink: vi.fn().mockReturnThis(),
    unsetLink: vi.fn().mockReturnThis(),
    run: vi.fn(),
  };
  return shallowRef({
    getAttributes: vi.fn((_mark: string) => ({ href: existingHref })),
    chain: vi.fn(() => chainResult),
    _chain: chainResult,
  } as any);
}

describe("useRichTextLinkDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct initial state", () => {
    const editor = createMockEditor();
    const result = useRichTextLinkDialog(editor);

    expect(result.showLinkDialog.value).toBe(false);
    expect(result.linkUrl.value).toBe("");
    expect(result.linkDialogRef.value).toBe(null);
  });

  describe("openLinkDialog", () => {
    it("opens dialog and populates URL from editor existing link", () => {
      const editor = createMockEditor("https://example.com");
      const result = useRichTextLinkDialog(editor);

      result.openLinkDialog();

      expect(result.showLinkDialog.value).toBe(true);
      expect(result.linkUrl.value).toBe("https://example.com");
      expect(editor.value.getAttributes).toHaveBeenCalledWith("link");
    });

    it("sets empty URL when no existing link", () => {
      const editor = createMockEditor("");
      const result = useRichTextLinkDialog(editor);

      result.openLinkDialog();

      expect(result.showLinkDialog.value).toBe(true);
      expect(result.linkUrl.value).toBe("");
    });

    it("opens with empty URL when editor is null", () => {
      const editor = shallowRef(null) as any;
      const result = useRichTextLinkDialog(editor);

      result.openLinkDialog();

      expect(result.showLinkDialog.value).toBe(true);
      expect(result.linkUrl.value).toBe("");
    });
  });

  describe("insertLink", () => {
    it("calls editor chain with full URL", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "https://test.com";
      result.insertLink();

      const chain = editor.value._chain;
      expect(editor.value.chain).toHaveBeenCalled();
      expect(chain.focus).toHaveBeenCalled();
      expect(chain.extendMarkRange).toHaveBeenCalledWith("link");
      expect(chain.setLink).toHaveBeenCalledWith({
        href: "https://test.com",
      });
      expect(chain.run).toHaveBeenCalled();
    });

    it("prepends https:// when URL does not start with http", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "example.com";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).toHaveBeenCalledWith({
        href: "https://example.com",
      });
    });

    it("preserves mailto: URLs without prefixing https://", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "mailto:foo@bar.com";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).toHaveBeenCalledWith({
        href: "mailto:foo@bar.com",
      });
    });

    it("preserves tel: URLs without prefixing https://", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "tel:+1234567890";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).toHaveBeenCalledWith({
        href: "tel:+1234567890",
      });
    });

    it("preserves anchor links without prefixing https://", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "#section-2";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).toHaveBeenCalledWith({
        href: "#section-2",
      });
    });

    it("does not call editor chain when URL is empty", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "";
      result.insertLink();

      expect(editor.value.chain).not.toHaveBeenCalled();
    });

    it("closes dialog after inserting link", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.showLinkDialog.value = true;
      result.linkUrl.value = "https://test.com";
      result.insertLink();

      expect(result.showLinkDialog.value).toBe(false);
      expect(result.linkUrl.value).toBe("");
    });

    it("closes dialog even when URL is empty", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.showLinkDialog.value = true;
      result.linkUrl.value = "";
      result.insertLink();

      expect(result.showLinkDialog.value).toBe(false);
      expect(result.linkUrl.value).toBe("");
    });
  });

  describe("removeLink", () => {
    it("unsets link and closes dialog", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.showLinkDialog.value = true;
      result.linkUrl.value = "https://test.com";
      result.removeLink();

      const chain = editor.value._chain;
      expect(editor.value.chain).toHaveBeenCalled();
      expect(chain.focus).toHaveBeenCalled();
      expect(chain.extendMarkRange).toHaveBeenCalledWith("link");
      expect(chain.unsetLink).toHaveBeenCalled();
      expect(chain.run).toHaveBeenCalled();
      expect(result.showLinkDialog.value).toBe(false);
      expect(result.linkUrl.value).toBe("");
    });
  });

  describe("closeLinkDialog", () => {
    it("resets state", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.showLinkDialog.value = true;
      result.linkUrl.value = "https://example.com";
      result.closeLinkDialog();

      expect(result.showLinkDialog.value).toBe(false);
      expect(result.linkUrl.value).toBe("");
    });
  });

  describe("handleLinkKeydown", () => {
    it("calls insertLink on Enter key", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);
      const event = {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;

      result.linkUrl.value = "https://enter-test.com";
      result.showLinkDialog.value = true;
      result.handleLinkKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      const chain = editor.value._chain;
      expect(chain.setLink).toHaveBeenCalledWith({
        href: "https://enter-test.com",
      });
      expect(result.showLinkDialog.value).toBe(false);
      expect(result.linkUrl.value).toBe("");
    });

    it("closes dialog on Escape key", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);
      const event = {
        key: "Escape",
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;

      result.showLinkDialog.value = true;
      result.linkUrl.value = "https://example.com";
      result.handleLinkKeydown(event);

      expect(result.showLinkDialog.value).toBe(false);
      expect(result.linkUrl.value).toBe("");
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("does nothing for other keys", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);
      const event = {
        key: "a",
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;

      result.showLinkDialog.value = true;
      result.linkUrl.value = "https://example.com";
      result.handleLinkKeydown(event);

      expect(result.showLinkDialog.value).toBe(true);
      expect(result.linkUrl.value).toBe("https://example.com");
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(editor.value.chain).not.toHaveBeenCalled();
    });
  });
});
