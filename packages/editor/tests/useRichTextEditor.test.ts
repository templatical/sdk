import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const composableSrc = readFileSync(
  resolve(__dirname, "../src/composables/useRichTextEditor.ts"),
  "utf-8",
);

const linkDialogSrc = readFileSync(
  resolve(__dirname, "../src/composables/useRichTextLinkDialog.ts"),
  "utf-8",
);

describe("useRichTextEditor composable structure", () => {
  it("exports UseRichTextEditorOptions interface with required fields", () => {
    expect(composableSrc).toContain("blockId: () => string");
    expect(composableSrc).toContain("blockContent: () => string");
    expect(composableSrc).toContain("loadExtensions: (ctx: MergeTagContext)");
    expect(composableSrc).toContain("onDone: () => void");
  });

  it("exports optional onClickOutsideSideEffect callback", () => {
    expect(composableSrc).toContain(
      "onClickOutsideSideEffect?: (target: HTMLElement) => void",
    );
  });

  it("exports optional editorName for error logging", () => {
    expect(composableSrc).toContain("editorName?: string");
  });

  it("exports MergeTagContext with mergeTags and syntax", () => {
    expect(composableSrc).toContain("export interface MergeTagContext");
    expect(composableSrc).toMatch(/mergeTags:.*useMergeTag.*\["mergeTags"\]/);
    expect(composableSrc).toMatch(/syntax:.*useMergeTag.*\["syntax"\]/);
  });

  it("returns editor and EditorContent shallow refs", () => {
    expect(composableSrc).toContain(
      "editor: ShallowRef<Editor | null>",
    );
    expect(composableSrc).toContain(
      "EditorContent: ShallowRef<typeof EditorContentComponent | null>",
    );
  });

  it("returns isLoading state ref", () => {
    expect(composableSrc).toContain("isLoading: Ref<boolean>");
  });

  it("returns link dialog state and functions", () => {
    expect(composableSrc).toContain("showLinkDialog: Ref<boolean>");
    expect(composableSrc).toContain("linkUrl: Ref<string>");
    expect(composableSrc).toContain("linkDialogRef: Ref<HTMLElement | null>");
    expect(composableSrc).toContain("openLinkDialog: () => void");
    expect(composableSrc).toContain("insertLink: () => void");
    expect(composableSrc).toContain("removeLink: () => void");
    expect(composableSrc).toContain("closeLinkDialog: () => void");
    expect(composableSrc).toContain(
      "handleLinkKeydown: (event: KeyboardEvent) => void",
    );
  });

  it("returns merge tag state and handler", () => {
    expect(composableSrc).toContain("mergeTagEnabled:");
    expect(composableSrc).toContain("isRequestingMergeTag:");
    expect(composableSrc).toContain(
      "handleAddMergeTag: () => Promise<void>",
    );
  });
});

describe("useRichTextEditor implementation", () => {
  it("injects editor from context", () => {
    expect(composableSrc).toContain('inject(EDITOR_KEY)');
  });

  it("delegates link dialog to useRichTextLinkDialog", () => {
    expect(composableSrc).toContain("useRichTextLinkDialog(editor)");
    expect(linkDialogSrc).toContain(
      "useFocusTrap(linkDialogRef, showLinkDialog)",
    );
  });

  it("sets up useTimeoutFn at setup time for focus", () => {
    expect(composableSrc).toContain("useTimeoutFn(");
    expect(composableSrc).toContain('focus("end")');
  });

  it("calls initEditor which invokes loadExtensions with merge tag context", () => {
    expect(composableSrc).toContain(
      "await options.loadExtensions({",
    );
    expect(composableSrc).toContain("mergeTags,");
    expect(composableSrc).toContain("syntax,");
  });

  it("deduplicates extensions by name", () => {
    expect(composableSrc).toContain("const seen = new Map<string, number>()");
    expect(composableSrc).toContain("seen.get(ext.name) === i");
  });

  it("watches block content for external updates", () => {
    expect(composableSrc).toContain("options.blockContent()");
    expect(composableSrc).toContain("setContent(newContent, { emitUpdate: false })");
  });

  it("handles click outside with optional side effect callback", () => {
    expect(composableSrc).toContain(
      "options.onClickOutsideSideEffect?.(target)",
    );
    expect(composableSrc).toContain(".tpl-text-editor-wrapper");
    expect(composableSrc).toContain(".tpl-text-toolbar");
    expect(composableSrc).toContain(".tpl-link-dialog");
  });

  it("calls onDone when clicking outside editor areas", () => {
    expect(composableSrc).toContain("options.onDone()");
  });

  it("registers document mousedown listener via useEventListener", () => {
    expect(composableSrc).toContain(
      'useEventListener(document, "mousedown", handleClickOutside)',
    );
  });

  it("cleans up on unmount: stops timeout and destroys editor", () => {
    expect(composableSrc).toContain("onBeforeUnmount(() => {");
    expect(composableSrc).toContain("stopFocusTimeout()");
    expect(composableSrc).toContain("editor.value?.destroy()");
  });

  it("openLinkDialog reads current link href", () => {
    expect(linkDialogSrc).toContain('getAttributes("link").href');
  });

  it("insertLink auto-prepends https:// when missing", () => {
    expect(linkDialogSrc).toContain('startsWith("http")');
    expect(linkDialogSrc).toContain("`https://${linkUrl.value}`");
  });

  it("handleAddMergeTag inserts merge tag via editor chain", () => {
    expect(composableSrc).toContain("requestMergeTag()");
    expect(composableSrc).toContain(".insertMergeTag(");
  });

  it("logs error with editorName on init failure", () => {
    expect(composableSrc).toContain("options.editorName");
    expect(composableSrc).toContain("RichTextEditor");
  });
});

// ── Consumers use useRichTextEditor ───────────────────────────────────────────

describe("TitleEditor.vue uses useRichTextEditor", () => {
  const src = readFileSync(
    resolve(
      __dirname,
      "../src/components/blocks/TitleEditor.vue",
    ),
    "utf-8",
  );

  it("imports useRichTextEditor", () => {
    expect(src).toContain(
      'import { useRichTextEditor } from "../../composables/useRichTextEditor"',
    );
  });

  it("destructures all needed return values", () => {
    expect(src).toContain("editor,");
    expect(src).toContain("EditorContent,");
    expect(src).toContain("isLoading,");
    expect(src).toContain("showLinkDialog,");
    expect(src).toContain("linkUrl,");
    expect(src).toContain("openLinkDialog,");
    expect(src).toContain("handleAddMergeTag,");
  });

  it("passes TitleEditor as editorName", () => {
    expect(src).toContain('editorName: "TitleEditor"');
  });

  it("provides loadExtensions with title-specific StarterKit config", () => {
    expect(src).toContain("bulletList: false");
    expect(src).toContain("orderedList: false");
    expect(src).toContain("listItem: false");
    expect(src).toContain("strike: false");
  });

  it("does not import useMergeTag, useFocusTrap, useEventListener directly", () => {
    expect(src).not.toContain("import { useMergeTag");
    expect(src).not.toContain("useEventListener");
    expect(src).not.toContain("onBeforeUnmount");
  });

  it("delegates editor content rendering to RichTextEditorContent", () => {
    expect(src).toContain("RichTextEditorContent");
    expect(src).toContain("RichTextLinkDialog");
  });
});

describe("ParagraphEditor.vue uses useRichTextEditor", () => {
  const src = readFileSync(
    resolve(
      __dirname,
      "../src/components/blocks/ParagraphEditor.vue",
    ),
    "utf-8",
  );

  it("imports useRichTextEditor", () => {
    expect(src).toContain(
      'import { useRichTextEditor } from "../../composables/useRichTextEditor"',
    );
  });

  it("passes ParagraphEditor as editorName", () => {
    expect(src).toContain('editorName: "ParagraphEditor"');
  });

  it("delegates toolbar to ParagraphToolbar component", () => {
    expect(src).toContain("ParagraphToolbar");
    expect(src).not.toContain("useEmoji");
    expect(src).not.toContain("closeEmojiPicker");
  });

  it("loads paragraph-specific extensions (underline, subscript, etc.)", () => {
    expect(src).toContain("@tiptap/extension-underline");
    expect(src).toContain("@tiptap/extension-subscript");
    expect(src).toContain("@tiptap/extension-superscript");
    expect(src).toContain("@tiptap/extension-text-align");
    expect(src).toContain("@tiptap/extension-color");
    expect(src).toContain("@tiptap/extension-font-family");
  });

  it("does not import useMergeTag, useFocusTrap, useEventListener directly", () => {
    expect(src).not.toContain("import { useMergeTag");
    expect(src).not.toContain("useEventListener");
    expect(src).not.toContain("onBeforeUnmount");
  });

  it("delegates editor content rendering to RichTextEditorContent", () => {
    expect(src).toContain("RichTextEditorContent");
    expect(src).toContain("RichTextLinkDialog");
  });
});

describe("RichTextEditorContent.vue casts editor correctly", () => {
  const src = readFileSync(
    resolve(
      __dirname,
      "../src/components/blocks/RichTextEditorContent.vue",
    ),
    "utf-8",
  );

  it("casts editor to Editor from @tiptap/vue-3, not any", () => {
    expect(src).toContain('import type { Editor } from "@tiptap/vue-3"');
    expect(src).toContain("editor as Editor");
    expect(src).not.toContain("editor as any");
  });
});
