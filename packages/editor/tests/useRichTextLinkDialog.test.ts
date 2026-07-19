import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { shallowRef } from "vue";

vi.mock("../src/composables/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

import { useRichTextLinkDialog } from "../src/composables/useRichTextLinkDialog";

function createMockEditor(
  existingHref = "",
  existingColor = "",
  { hasColorExtension = true }: { hasColorExtension?: boolean } = {},
) {
  const chainResult = {
    focus: vi.fn().mockReturnThis(),
    extendMarkRange: vi.fn().mockReturnThis(),
    setLink: vi.fn().mockReturnThis(),
    updateAttributes: vi.fn().mockReturnThis(),
    unsetLink: vi.fn().mockReturnThis(),
    unsetColor: vi.fn().mockReturnThis(),
    run: vi.fn(),
  };
  return shallowRef({
    getAttributes: vi.fn((_mark: string) => ({
      href: existingHref,
      color: existingColor,
    })),
    chain: vi.fn(() => chainResult),
    // The paragraph editor registers @tiptap/extension-color, so `unsetColor`
    // is a live command; the Title editor doesn't. `hasColorExtension: false`
    // models the Title case (the strip must be skipped there).
    commands: hasColorExtension ? { unsetColor: vi.fn() } : {},
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
    expect(result.linkColor.value).toBe("");
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

    it("populates color from the existing link's color", () => {
      const editor = createMockEditor("https://example.com", "#ff6600");
      const result = useRichTextLinkDialog(editor);

      result.openLinkDialog();

      expect(result.linkColor.value).toBe("#ff6600");
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

    it("stamps the link color on the <a> via updateAttributes", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "https://test.com";
      result.linkColor.value = "#e11d48";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.updateAttributes).toHaveBeenCalledWith("link", {
        color: "#e11d48",
      });
    });

    it("clears the link color (null) when none is set", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "https://test.com";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.updateAttributes).toHaveBeenCalledWith("link", {
        color: null,
      });
    });

    it("strips the inner text color (unsetColor) when a link color is set", () => {
      // Absolute priority: the color on the <a> must be the only color, so an
      // existing inner text-color span can't keep painting the glyphs while
      // only the underline picks up the link color.
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "https://test.com";
      result.linkColor.value = "#e11d48";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.updateAttributes).toHaveBeenCalledWith("link", {
        color: "#e11d48",
      });
      expect(chain.unsetColor).toHaveBeenCalledTimes(1);
      expect(chain.run).toHaveBeenCalledTimes(1);
    });

    it("does not strip the inner text color when no link color is set", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "https://test.com";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.updateAttributes).toHaveBeenCalledWith("link", {
        color: null,
      });
      expect(chain.unsetColor).not.toHaveBeenCalled();
    });

    it("does not strip when the editor has no Color extension (Title links)", () => {
      const editor = createMockEditor("", "", { hasColorExtension: false });
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "https://test.com";
      result.linkColor.value = "#e11d48";
      result.insertLink();

      const chain = editor.value._chain;
      // The color is still stamped on the <a>…
      expect(chain.updateAttributes).toHaveBeenCalledWith("link", {
        color: "#e11d48",
      });
      // …but unsetColor would throw on the Title editor (no Color command), so
      // the strip is skipped.
      expect(chain.unsetColor).not.toHaveBeenCalled();
      expect(chain.run).toHaveBeenCalledTimes(1);
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

    it("rejects javascript: scheme", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "javascript:alert(1)";
      result.showLinkDialog.value = true;
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).not.toHaveBeenCalled();
      expect(result.showLinkDialog.value).toBe(false);
    });

    it("rejects data: scheme", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "data:text/html,<script>alert(1)</script>";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).not.toHaveBeenCalled();
    });

    it("rejects vbscript: scheme", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "vbscript:msgbox(1)";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).not.toHaveBeenCalled();
    });

    it("rejects file: scheme", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "file:///etc/passwd";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).not.toHaveBeenCalled();
    });

    it("rejects case-bypassed JAVASCRIPT: scheme", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "JaVaScRiPt:alert(1)";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).not.toHaveBeenCalled();
    });

    it("rejects whitespace-padded javascript: scheme", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "  javascript:alert(1)";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).not.toHaveBeenCalled();
    });

    it("preserves ftp: and ftps: URLs", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "ftp://example.com/file";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).toHaveBeenCalledWith({
        href: "ftp://example.com/file",
      });
    });

    it("preserves sms: URLs", () => {
      const editor = createMockEditor();
      const result = useRichTextLinkDialog(editor);

      result.linkUrl.value = "sms:+15555550100";
      result.insertLink();

      const chain = editor.value._chain;
      expect(chain.setLink).toHaveBeenCalledWith({
        href: "sms:+15555550100",
      });
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
      result.linkColor.value = "#abcabc";
      result.closeLinkDialog();

      expect(result.showLinkDialog.value).toBe(false);
      expect(result.linkUrl.value).toBe("");
      expect(result.linkColor.value).toBe("");
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
