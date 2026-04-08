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

describe("CloudEditor.vue dead provides cleanup", () => {
  const src = readSrc("cloud/CloudEditor.vue");

  it("does not provide dragDrop (unused inject)", () => {
    expect(src).not.toContain('provide("dragDrop"');
  });

  it("has all provides in the provides section, not scattered across the file", () => {
    const providesSection = src.indexOf(
      "Provides — all synchronous",
    );
    const translationsProvide = src.indexOf('provide("translations"');
    expect(translationsProvide).toBeGreaterThan(providesSection);
  });
});

describe("CloudEditor.vue platform detection removed", () => {
  const src = readSrc("cloud/CloudEditor.vue");

  it("does not use navigator.platform or navigator.userAgent for modifier key detection", () => {
    expect(src).not.toContain("navigator.platform");
    expect(src).not.toContain("navigator.userAgent");
    expect(src).not.toContain("isMac");
  });

  it("uses shared handleEditorKeydown from keyboardShortcuts utility", () => {
    expect(src).toContain(
      'import { handleEditorKeydown } from "../utils/keyboardShortcuts"',
    );
    expect(src).toContain("handleEditorKeydown(event,");
  });
});

// ── Unmount guards on async lifecycle functions ──────────────────────────────

describe("CloudEditor.vue async functions guard against post-unmount execution", () => {
  const src = readSrc("cloud/CloudEditor.vue");

  it("declares a _destroyed flag", () => {
    expect(src).toContain("let _destroyed = false");
  });

  it("sets _destroyed = true in onUnmounted before cleanup", () => {
    const unmountedIdx = src.indexOf("onUnmounted(");
    const destroyedIdx = src.indexOf("_destroyed = true");
    expect(destroyedIdx).toBeGreaterThan(unmountedIdx);
    // _destroyed should be set before websocket.disconnect etc.
    const disconnectIdx = src.indexOf(
      "websocket.disconnect()",
      unmountedIdx,
    );
    expect(destroyedIdx).toBeLessThan(disconnectIdx);
  });

  it("initialize() checks _destroyed after every await", () => {
    const initFn = src.slice(
      src.indexOf("async function initialize()"),
      src.indexOf("// Error display helpers"),
    );
    // 3 await points, 3 guards + catch guard + finally guard
    const guardCount = (initFn.match(/if \(_destroyed\)/g) || []).length;
    expect(guardCount).toBeGreaterThanOrEqual(4);
  });

  it("createTemplate() checks _destroyed after await", () => {
    const fn = src.slice(
      src.indexOf("async function createTemplate"),
      src.indexOf("async function loadTemplate"),
    );
    expect(fn).toContain("if (_destroyed)");
  });

  it("loadTemplate() checks _destroyed after await", () => {
    const fn = src.slice(
      src.indexOf("async function loadTemplate"),
      src.indexOf("async function preRenderCustomBlocks") !== -1
        ? src.indexOf("async function preRenderCustomBlocks")
        : src.indexOf("function preRenderCustomBlocks"),
    );
    expect(fn).toContain("if (_destroyed)");
  });

  it("saveTemplate() checks _destroyed after each await and guards catch/finally", () => {
    const fn = src.slice(
      src.indexOf("async function saveTemplate"),
      src.indexOf("// ----", src.indexOf("async function saveTemplate")),
    );
    const guardCount = (fn.match(/_destroyed/g) || []).length;
    // 3 await guards + catch guard + finally guard = 5
    expect(guardCount).toBeGreaterThanOrEqual(5);
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
  it("OSS config uses named OnRequestMedia type", () => {
    const src = readSrc("index.ts");
    expect(src).toContain("onRequestMedia?: OnRequestMedia");
    expect(src).toContain("export type OnRequestMedia");
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

  it("consumers inject onRequestMedia directly, not via config wrapper", () => {
    const consumers = [
      readSrc("components/blocks/ImageBlock.vue"),
      readSrc("components/toolbar/ImageToolbar.vue"),
      readSrc("components/toolbar/fields/ImageField.vue"),
    ];
    for (const src of consumers) {
      expect(src).toContain('inject<OnRequestMedia | null>("onRequestMedia"');
      expect(src).not.toContain('inject<TemplaticalEditorConfig>');
      expect(src).not.toContain('provide("config"');
    }
  });

  it("neither editor provides a config wrapper object", () => {
    const oss = readSrc("Editor.vue");
    const cloud = readSrc("cloud/CloudEditor.vue");
    expect(oss).not.toContain('provide("config"');
    expect(cloud).not.toContain('provide("config"');
    // Both provide onRequestMedia directly
    expect(oss).toContain('provide("onRequestMedia"');
    expect(cloud).toContain('provide("onRequestMedia"');
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
  it("Canvas.vue computes lock holder once per block via scoped v-for", () => {
    const src = readSrc("components/Canvas.vue");
    expect(src).toContain("v-for=\"lockHolder in [getBlockLock(block.id)]\"");
    expect(src).not.toContain("getBlockLockHolder(block.id)!");
  });

  it("Canvas.vue uses CloudPlanConfig and CloudAiConfig", () => {
    const src = readSrc("components/Canvas.vue");
    expect(src).toContain("inject<CloudPlanConfig | null>");
    expect(src).toContain("inject<CloudAiConfig | null>");
    expect(src).not.toContain("inject<any>");
  });

  it("Canvas.vue injects blockRegistry with null default, not unsafe cast", () => {
    const src = readSrc("components/Canvas.vue");
    expect(src).toContain('inject<UseBlockRegistryReturn | null>');
    expect(src).not.toContain("undefined as unknown as");
    expect(src).not.toContain("undefined as never");
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

// ── BlockWrapper uses shared getBlockWrapperStyle utility ────────────────────

describe("BlockWrapper.vue uses shared getBlockWrapperStyle", () => {
  const src = readSrc("components/blocks/BlockWrapper.vue");

  it("imports getBlockWrapperStyle from blockComponentResolver", () => {
    expect(src).toContain(
      'import { getBlockWrapperStyle } from "../../utils/blockComponentResolver"',
    );
  });

  it("calls getBlockWrapperStyle instead of inlining style computation", () => {
    expect(src).toContain("getBlockWrapperStyle(props.block)");
    expect(src).not.toMatch(
      /padding\.top.*px.*padding\.right.*px.*padding\.bottom.*px/,
    );
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

// ── Rich text editors use i18n for all loading/error strings ─────────────────

describe("ParagraphEditor and TitleEditor use i18n for loading/error states", () => {
  const paragraphSrc = readSrc("components/blocks/ParagraphEditor.vue");
  const titleSrc = readSrc("components/blocks/TitleEditor.vue");

  it("ParagraphEditor has no hardcoded English loading/error strings", () => {
    expect(paragraphSrc).not.toContain('"Loading editor..."');
    expect(paragraphSrc).not.toContain('"Loading..."');
    expect(paragraphSrc).not.toContain('"Failed to load editor."');
    expect(paragraphSrc).not.toContain('"Retry"');
  });

  it("TitleEditor has no hardcoded English loading/error strings", () => {
    expect(titleSrc).not.toContain('"Loading editor..."');
    expect(titleSrc).not.toContain('"Loading..."');
    expect(titleSrc).not.toContain('"Failed to load editor."');
    expect(titleSrc).not.toContain('"Retry"');
  });

  it("both use t.errors.editorLoading for loading state", () => {
    expect(paragraphSrc).toContain("t.errors.editorLoading");
    expect(titleSrc).toContain("t.errors.editorLoading");
  });

  it("both use t.errors.editorLoadFailed without optional chaining", () => {
    expect(paragraphSrc).toContain("t.errors.editorLoadFailed");
    expect(paragraphSrc).not.toContain("t.errors?.editorLoadFailed");
    expect(titleSrc).toContain("t.errors.editorLoadFailed");
    expect(titleSrc).not.toContain("t.errors?.editorLoadFailed");
  });

  it("both use t.errors.retry without optional chaining", () => {
    expect(paragraphSrc).toContain("t.errors.retry");
    expect(paragraphSrc).not.toContain("t.errors?.retry");
    expect(titleSrc).toContain("t.errors.retry");
    expect(titleSrc).not.toContain("t.errors?.retry");
  });
});

// ── Rich text toolbar button class extraction ───────────────────────────────

describe("ParagraphEditor and TitleEditor use shared toolbar button class", () => {
  const paragraphSrc = readSrc("components/blocks/ParagraphEditor.vue");
  const titleSrc = readSrc("components/blocks/TitleEditor.vue");
  const cssSrc = readSrc("styles/index.css");

  it("shared stylesheet defines .tpl-text-toolbar-btn and active modifier", () => {
    expect(cssSrc).toContain(".tpl-text-toolbar-btn");
    expect(cssSrc).toContain(".tpl-text-toolbar-btn--active");
  });

  it("ParagraphEditor uses the shared class instead of inline Tailwind", () => {
    expect(paragraphSrc).toContain('class="tpl-text-toolbar-btn"');
    expect(paragraphSrc).toContain("'tpl-text-toolbar-btn--active':");
    expect(paragraphSrc).not.toContain(
      "tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent",
    );
  });

  it("TitleEditor uses the shared class instead of inline Tailwind", () => {
    expect(titleSrc).toContain('class="tpl-text-toolbar-btn"');
    expect(titleSrc).toContain("'tpl-text-toolbar-btn--active':");
    expect(titleSrc).not.toContain(
      "tpl:flex tpl:size-8 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded tpl:border-none tpl:bg-transparent",
    );
  });
});

// ── handleFix error handling ─────────────────────────────────────────────────

describe("TemplateScoringPanel scoring instance is provided, not local", () => {
  const panelSrc = readSrc("cloud/components/TemplateScoringPanel.vue");
  const cloudSrc = readSrc("cloud/CloudEditor.vue");

  it("panel injects scoring instead of instantiating useTemplateScoring", () => {
    expect(panelSrc).toContain('inject<UseTemplateScoringReturn>("scoring")');
    expect(panelSrc).not.toContain("useTemplateScoring({");
  });

  it("CloudEditor instantiates and provides scoring", () => {
    expect(cloudSrc).toContain("useTemplateScoring({");
    expect(cloudSrc).toContain('provide("scoring"');
  });
});

describe("TemplateScoringPanel handleFix error handling", () => {
  const src = readSrc("cloud/components/TemplateScoringPanel.vue");

  it("delegates error handling to the composable (no local try/catch)", () => {
    expect(src).not.toMatch(/catch\s*\(\s*error\s*\)/);
    expect(src).not.toMatch(/const fixError\s*=\s*ref/);
  });

  it("displays composable fixError in the template", () => {
    expect(src).toContain('v-if="scoring.fixError.value"');
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

// ── TemplateScoringPanel uses composable error state ─────────────────────────

describe("TemplateScoringPanel.vue error handling", () => {
  const src = readSrc("cloud/components/TemplateScoringPanel.vue");

  it("does not define a local fixError ref (uses composable state)", () => {
    expect(src).not.toMatch(/const fixError\s*=\s*ref/);
  });

  it("uses scoring.fixError.value for per-finding error display", () => {
    expect(src).toContain("scoring.fixError.value");
  });

  it("does not have a local try/catch for fix errors", () => {
    // handleFix should not catch errors locally — the composable handles it
    expect(src).not.toMatch(/catch\s*\(\s*error\s*\)/);
  });
});

// ── Cloud components use useI18n() composable ────────────────────────────────

describe("cloud components use useI18n() instead of direct inject", () => {
  it("CommentsSidebar.vue uses useI18n and format()", () => {
    const src = readSrc("cloud/components/CommentsSidebar.vue");
    expect(src).toContain('import { useI18n } from "../../composables/useI18n"');
    expect(src).toContain("const { t, format } = useI18n()");
    expect(src).not.toContain('inject<Translations>("translations")');
    expect(src).not.toContain("import type { Translations }");
  });

  it("CommentsSidebar.vue uses format() instead of .replace() for interpolation", () => {
    const src = readSrc("cloud/components/CommentsSidebar.vue");
    expect(src).toContain("format(t.comments.resolvedBy,");
    expect(src).toContain("format(t.comments.replyOne,");
    expect(src).toContain("format(t.comments.replyMany,");
    expect(src).not.toMatch(/t\.comments\.\w+\.replace\(/);
  });

  it("TemplateScoringPanel.vue uses useI18n()", () => {
    const src = readSrc("cloud/components/TemplateScoringPanel.vue");
    expect(src).toContain('import { useI18n } from "../../composables/useI18n"');
    expect(src).toContain("const { t } = useI18n()");
    expect(src).not.toContain('inject<Translations>("translations")');
    expect(src).not.toContain("import type { Translations }");
  });

  it("DesignReferenceSidebar.vue uses useI18n() with t.designReference prefix", () => {
    const src = readSrc("cloud/components/DesignReferenceSidebar.vue");
    expect(src).toContain('import { useI18n } from "../../composables/useI18n"');
    expect(src).toContain("const { t } = useI18n()");
    expect(src).not.toContain('inject<Translations>("translations")');
    expect(src).not.toContain("import type { Translations }");
    // No computed alias wrapping translations — uses t.designReference.xxx directly
    expect(src).not.toContain("computed(() => translations.designReference)");
    expect(src).toContain("t.designReference.title");
  });
});
