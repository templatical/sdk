import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INIT_TIMEOUT_MS,
  COLLAB_UNDO_WARNING_MS,
  DEFAULT_AUTO_SAVE_DEBOUNCE_MS,
  MAX_UPLOAD_SIZE_BYTES,
} from "../src/constants/timeouts";

function readSrc(relativePath: string): string {
  return readFileSync(resolve(__dirname, "..", "src", relativePath), "utf-8");
}

describe("timeout constants", () => {
  it("INIT_TIMEOUT_MS is 30 seconds", () => {
    expect(INIT_TIMEOUT_MS).toBe(30000);
  });

  it("COLLAB_UNDO_WARNING_MS is 4 seconds", () => {
    expect(COLLAB_UNDO_WARNING_MS).toBe(4000);
  });

  it("DEFAULT_AUTO_SAVE_DEBOUNCE_MS is 5 seconds", () => {
    expect(DEFAULT_AUTO_SAVE_DEBOUNCE_MS).toBe(5000);
  });

  it("MAX_UPLOAD_SIZE_BYTES is 10 MB", () => {
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("constant consumers", () => {
  it("index.ts uses INIT_TIMEOUT_MS instead of 30000", () => {
    const src = readSrc("index.ts");
    expect(src).toContain("INIT_TIMEOUT_MS");
    expect(src).not.toMatch(/setTimeout[\s\S]*?30000/);
  });

  it("CloudEditor.vue uses COLLAB_UNDO_WARNING_MS instead of 4000", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    expect(src).toContain("COLLAB_UNDO_WARNING_MS");
    expect(src).not.toMatch(/}, 4000\)/);
  });

  it("CloudEditor.vue uses DEFAULT_AUTO_SAVE_DEBOUNCE_MS instead of 5000", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    expect(src).toContain("DEFAULT_AUTO_SAVE_DEBOUNCE_MS");
    expect(src).not.toMatch(/\?\? 5000/);
  });

  it("DesignReferenceSidebar.vue uses MAX_UPLOAD_SIZE_BYTES", () => {
    const src = readSrc("cloud/components/DesignReferenceSidebar.vue");
    expect(src).toContain("MAX_UPLOAD_SIZE_BYTES");
    expect(src).not.toContain("10 * 1024 * 1024");
  });
});

describe("CloudEditor.vue deprecated API fix", () => {
  const src = readSrc("cloud/CloudEditor.vue");

  it("does not use deprecated navigator.platform", () => {
    expect(src).not.toContain("navigator.platform");
  });

  it("uses navigator.userAgent for Mac detection", () => {
    expect(src).toMatch(/navigator\.userAgent/);
  });
});

// ── useTimeoutFn setup-time pattern ──────────────────────────────────────────

describe("useTimeoutFn called at setup time, not inside callbacks", () => {
  it("CloudEditor.vue calls useTimeoutFn at setup time for collab undo warning", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    // Should have a setup-time useTimeoutFn with { immediate: false }
    expect(src).toMatch(
      /const \{ start: startCollabUndoWarningTimeout \} = useTimeoutFn/,
    );
    // showCollabUndoWarning should call start(), not useTimeoutFn directly
    expect(src).toContain("startCollabUndoWarningTimeout()");
  });

  it("AiChatSidebar.vue calls useTimeoutFn at setup time for reveal delay", () => {
    const src = readSrc("cloud/components/AiChatSidebar.vue");
    // Should have a setup-time useTimeoutFn with { immediate: false }
    expect(src).toMatch(
      /const \{ start: startRevealTimeout \} = useTimeoutFn/,
    );
    // Should NOT call useTimeoutFn inside a watch callback
    expect(src).not.toMatch(/watch\([\s\S]*?useTimeoutFn\(/);
  });
});

// ── Type safety improvements ─────────────────────────────────────────────────

describe("cloudEditorRef typed without Ref<any>", () => {
  it("index.ts does not use Ref<any> for cloudEditorRef", () => {
    const src = readSrc("index.ts");
    expect(src).not.toMatch(/cloudEditorRef:\s*Ref<any>/);
    expect(src).toContain("cloudEditorRef: Ref<InstanceType<");
    expect(src).toContain('typeof import("./cloud/CloudEditor.vue").default');
  });
});

describe("UseBlockRegistryReturn used instead of ReturnType<typeof useBlockRegistry>", () => {
  it("PreviewSectionBlock.vue imports UseBlockRegistryReturn", () => {
    const src = readSrc("components/blocks/PreviewSectionBlock.vue");
    expect(src).toContain("UseBlockRegistryReturn");
    expect(src).not.toContain("ReturnType<typeof useBlockRegistry>");
  });

  it("ModulePreviewCanvas.vue imports UseBlockRegistryReturn", () => {
    const src = readSrc("cloud/components/ModulePreviewCanvas.vue");
    expect(src).toContain("UseBlockRegistryReturn");
    expect(src).not.toContain("ReturnType<typeof useBlockRegistry>");
  });
});

// ── Plugin extension stubs removed ───────────────────────────────────────────

describe("plugin extension no-op stubs removed", () => {
  it("Editor.vue plugin context does not contain registerToolbarAction", () => {
    const src = readSrc("Editor.vue");
    expect(src).not.toContain("registerToolbarAction");
    expect(src).not.toContain("registerSidebarPanel");
    expect(src).not.toContain("registerBlockAction");
  });

  it("plugins.ts does not export ToolbarAction, SidebarPanel, or BlockContextAction", () => {
    const src = readFileSync(
      resolve(__dirname, "../../core/src/plugins.ts"),
      "utf-8",
    );
    expect(src).not.toContain("ToolbarAction");
    expect(src).not.toContain("SidebarPanel");
    expect(src).not.toContain("BlockContextAction");
  });

  it("index.ts does not re-export ToolbarAction or SidebarPanel", () => {
    const src = readSrc("index.ts");
    expect(src).not.toContain("ToolbarAction");
    expect(src).not.toContain("SidebarPanel");
  });
});

// ── onRequestMedia unified signature ─────────────────────────────────────────

describe("onRequestMedia signature unified with optional context", () => {
  it("OSS config accepts optional MediaRequestContext parameter", () => {
    const src = readSrc("index.ts");
    expect(src).toContain("onRequestMedia?: (");
    expect(src).toContain("context?: MediaRequestContext");
    expect(src).toContain("Promise<MediaResult | null>");
  });

  it("ImageBlock.vue passes accept context", () => {
    const src = readSrc("components/blocks/ImageBlock.vue");
    expect(src).toContain('onRequestMedia?.({ accept: ["images"] })');
  });

  it("ImageToolbar.vue passes accept context", () => {
    const src = readSrc("components/toolbar/ImageToolbar.vue");
    expect(src).toContain('onRequestMedia?.({ accept: ["images"] })');
  });

  it("ImageField.vue passes accept context", () => {
    const src = readSrc("components/toolbar/fields/ImageField.vue");
    expect(src).toContain('onRequestMedia?.({ accept: ["images"] })');
  });

  it("no call sites use parameterless onRequestMedia?()", () => {
    const files = [
      readSrc("components/blocks/ImageBlock.vue"),
      readSrc("components/toolbar/ImageToolbar.vue"),
      readSrc("components/toolbar/fields/ImageField.vue"),
    ];
    for (const src of files) {
      expect(src).not.toMatch(/onRequestMedia\?\.\(\)/);
    }
  });
});

// ── History interceptor composable extraction ────────────────────────────────

describe("useHistoryInterceptor replaces manual wrapping", () => {
  it("Editor.vue uses useHistoryInterceptor", () => {
    const src = readSrc("Editor.vue");
    expect(src).toContain("useHistoryInterceptor(editor, history)");
    expect(src).not.toContain("const originalAddBlock = editor.addBlock");
    expect(src).not.toContain("const originalRemoveBlock = editor.removeBlock");
  });

  it("CloudEditor.vue uses useHistoryInterceptor", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    expect(src).toContain("useHistoryInterceptor(editor, history)");
    expect(src).not.toContain(
      "const historyOriginalAddBlock = editor.addBlock",
    );
  });

  it("CloudEditor.vue uses useCollaborationBroadcast", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    expect(src).toContain("useCollaborationBroadcast(editor, collaboration)");
    expect(src).not.toContain("const originalAddBlock = editor.addBlock");
    expect(src).not.toContain(
      "const originalUpdateBlock = editor.updateBlock",
    );
  });
});

// ── useMergeTagField composable extraction ───────────────────────────────────

describe("useMergeTagField extracts shared logic from MergeTag components", () => {
  it("composable exports MergeTagSegment type and useMergeTagField function", () => {
    const src = readSrc("composables/useMergeTagField.ts");
    expect(src).toContain("export type MergeTagSegment");
    expect(src).toContain("export function useMergeTagField");
  });

  it("composable contains segment parsing logic", () => {
    const src = readSrc("composables/useMergeTagField.ts");
    expect(src).toContain("const segments = computed");
    expect(src).toContain("const hasMergeTags = computed");
    expect(src).toContain("async function insertMergeTag");
    expect(src).toContain("isMergeTagValue");
    expect(src).toContain("isLogicMergeTagValue");
  });

  it("MergeTagInput.vue no longer has inline segment logic", () => {
    const src = readSrc("components/MergeTagInput.vue");
    expect(src).not.toContain("type Segment =");
    expect(src).not.toContain("isLogicMergeTagValue");
    expect(src).not.toContain("getLogicMergeTagKeyword");
  });

  it("MergeTagTextarea.vue no longer has inline segment logic", () => {
    const src = readSrc("components/MergeTagTextarea.vue");
    expect(src).not.toContain("type Segment =");
    expect(src).not.toContain("isLogicMergeTagValue");
    expect(src).not.toContain("getLogicMergeTagKeyword");
  });
});

// ── Cloud inject types ───────────────────────────────────────────────────────

describe("cloud-only injects use typed interfaces instead of any", () => {
  it("Canvas.vue uses CloudPlanConfig and CloudAiConfig", () => {
    const src = readSrc("components/Canvas.vue");
    expect(src).toContain("inject<CloudPlanConfig | null>");
    expect(src).toContain("inject<CloudAiConfig | null>");
    expect(src).not.toContain("inject<any>");
  });

  it("Sidebar.vue uses CloudSavedModules and CloudPlanConfig", () => {
    const src = readSrc("components/Sidebar.vue");
    expect(src).toContain("inject<CloudSavedModules | null>");
    expect(src).toContain("inject<CloudPlanConfig | null>");
    expect(src).not.toContain("inject<any>");
  });

  it("BlockWrapper.vue uses CloudComments, CloudSavedModules, and CloudPlanConfig", () => {
    const src = readSrc("components/blocks/BlockWrapper.vue");
    expect(src).toContain("inject<CloudComments | null>");
    expect(src).toContain("inject<CloudSavedModules | null>");
    expect(src).toContain("inject<CloudPlanConfig | null>");
    expect(src).not.toContain("inject<any>");
  });
});

// ── Font link cleanup ────────────────────────────────────────────────────────

describe("font link cleanup on unmount", () => {
  it("useFonts exposes cleanupFontLinks function", () => {
    const src = readSrc("composables/useFonts.ts");
    expect(src).toContain("function cleanupFontLinks(): void");
    expect(src).toContain("cleanupFontLinks,");
  });

  it("useFonts tracks created link elements", () => {
    const src = readSrc("composables/useFonts.ts");
    expect(src).toContain("createdLinks.push(link)");
    expect(src).toContain("link.remove()");
  });

  it("Editor.vue calls cleanupFontLinks on unmount", () => {
    const src = readSrc("Editor.vue");
    expect(src).toContain("fontsManager.cleanupFontLinks()");
  });

  it("CloudEditor.vue calls cleanupFontLinks on unmount", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    expect(src).toContain("fontsManager.cleanupFontLinks()");
  });
});

// ── handleFix error handling ─────────────────────────────────────────────────

describe("TemplateScoringPanel handleFix error handling", () => {
  it("wraps handleFix in try/catch", () => {
    const src = readSrc("cloud/components/TemplateScoringPanel.vue");
    expect(src).toContain("try {");
    expect(src).toContain("} catch (error) {");
    expect(src).toContain("fixError.value =");
  });

  it("displays fixError in the template", () => {
    const src = readSrc("cloud/components/TemplateScoringPanel.vue");
    expect(src).toContain("v-if=\"fixError\"");
  });
});

// ── TipTap init error with retry ─────────────────────────────────────────────

describe("useRichTextEditor init error and retry", () => {
  it("composable exports initError ref and retry function", () => {
    const src = readSrc("composables/useRichTextEditor.ts");
    expect(src).toContain("initError: Ref<string | null>");
    expect(src).toContain("retry: () => void");
    expect(src).toContain("initError,");
    expect(src).toContain("retry,");
  });

  it("sets initError on catch and clears it on retry", () => {
    const src = readSrc("composables/useRichTextEditor.ts");
    expect(src).toContain("initError.value =");
    expect(src).toContain("function retry(): void");
    expect(src).toContain("initError.value = null");
  });

  it("TitleEditor.vue destructures initError and retry", () => {
    const src = readSrc("components/blocks/TitleEditor.vue");
    expect(src).toContain("initError,");
    expect(src).toContain("retry,");
    expect(src).toContain('v-else-if="initError"');
    expect(src).toContain("@click=\"retry\"");
  });

  it("ParagraphEditor.vue destructures initError and retry", () => {
    const src = readSrc("components/blocks/ParagraphEditor.vue");
    expect(src).toContain("initError,");
    expect(src).toContain("retry,");
    expect(src).toContain('v-else-if="initError"');
    expect(src).toContain("@click=\"retry\"");
  });
});

// ── Unified useI18n pattern ──────────────────────────────────────────────────

describe("Editor.vue uses unified useI18n pattern", () => {
  const src = readSrc("Editor.vue");

  it("uses useI18n composable instead of custom t() function", () => {
    expect(src).toContain("useI18n(props.translations)");
    expect(src).not.toContain("function t(key: string");
    expect(src).not.toContain('key.split(".")');
  });

  it("receives translations as a prop", () => {
    expect(src).toContain("translations: Translations");
  });

  it("receives fontsManager as a prop", () => {
    expect(src).toContain("fontsManager: UseFontsReturn");
  });

  it("uses typed dot access for translations in template", () => {
    expect(src).toContain("t.header.title");
    expect(src).toContain("t.footer.poweredBy");
    expect(src).toContain("t.footer.openSource");
    expect(src).toContain("t.blockSettings.restoreHiddenBlocks");
    expect(src).not.toMatch(/t\(".*"\)/);
  });

  it("no longer has isReady loading guard", () => {
    expect(src).not.toContain("isReady");
    expect(src).not.toContain("initTranslations");
  });
});

describe("init() is async and loads translations before mount", () => {
  it("init returns Promise<TemplaticalEditor>", () => {
    const src = readSrc("index.ts");
    expect(src).toContain("async function init(");
    expect(src).toContain("Promise<TemplaticalEditor>");
  });

  it("loads translations before creating the app", () => {
    const src = readSrc("index.ts");
    expect(src).toContain("await loadTranslations(");
    expect(src).toContain("translations,");
    expect(src).toContain("fontsManager,");
  });
});

// ── Save status indicator ────────────────────────────────────────────────────

describe("CloudEditor.vue inline save status indicator", () => {
  const src = readSrc("cloud/CloudEditor.vue");

  it("defines saveStatus and saveErrorMessage refs", () => {
    expect(src).toContain(
      'const saveStatus = ref<"idle" | "saved" | "error">("idle")',
    );
    expect(src).toContain('const saveErrorMessage = ref("")');
  });

  it("sets saveStatus to saved on successful save with auto-clear", () => {
    expect(src).toContain('saveStatus.value = "saved"');
    expect(src).toContain("startSaveStatusClear()");
  });

  it("sets saveStatus to error on save failure with error message", () => {
    expect(src).toContain('saveStatus.value = "error"');
    expect(src).toContain("saveErrorMessage.value =");
  });

  it("shows error state with CircleAlert icon and tooltip", () => {
    expect(src).toContain('v-if="saveStatus === \'error\'"');
    expect(src).toContain("t.header.saveFailed");
    expect(src).toContain(":data-tooltip=\"saveErrorMessage\"");
  });

  it("shows saved state with Check icon", () => {
    expect(src).toContain('v-else-if="saveStatus === \'saved\'"');
    expect(src).toContain("t.header.saved");
  });

  it("still shows unsaved state when dirty", () => {
    expect(src).toContain('v-else-if="editor.state.isDirty"');
    expect(src).toContain("t.header.unsaved");
  });
});
