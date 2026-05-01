import { createApp, h, ref, type App, type Ref } from "vue";
import { INIT_TIMEOUT_MS } from "./constants/timeouts";
import type {
  BlockDefaults,
  CustomBlock,
  CustomBlockDefinition,
  DisplayConditionsConfig,
  FontsConfig,
  MediaResult,
  MergeTagsConfig,
  SaveResult,
  Template,
  TemplateContent,
  TemplateDefaults,
  ThemeOverrides,
  UiTheme,
} from "@templatical/types";
import type { MediaRequestContext } from "@templatical/media-library";

import Editor from "./Editor.vue";
import { loadTranslations } from "./i18n";
import { useFonts } from "./composables";
import { toMjmlForInstance } from "./utils/toMjml";

// ---------------------------------------------------------------------------
// OSS config + return types
// ---------------------------------------------------------------------------

export interface TemplaticalEditorConfig {
  container: string | HTMLElement;
  content?: TemplateContent;

  onChange?: (content: TemplateContent) => void;
  onSave?: (content: TemplateContent) => void;
  onError?: (error: Error) => void;

  onRequestMedia?: OnRequestMedia;

  mergeTags?: MergeTagsConfig;
  displayConditions?: DisplayConditionsConfig;
  customBlocks?: CustomBlockDefinition[];
  fonts?: FontsConfig;

  blockDefaults?: BlockDefaults;
  templateDefaults?: TemplateDefaults;

  theme?: ThemeOverrides;
  uiTheme?: UiTheme;
  locale?: string;

  /**
   * Show the "Powered by Templatical" footer. Defaults to `true`.
   * Set to `false` to hide the footer (no attribution required by the license).
   */
  branding?: boolean;
}

/** Function type for media browser requests, used by both OSS and Cloud editors. */
export type OnRequestMedia = (
  context?: MediaRequestContext,
) => Promise<MediaResult | null>;

interface TemplaticalEditorBase {
  getContent(): TemplateContent;
  setContent(content: TemplateContent): void;
  setTheme(theme: UiTheme): void;
  unmount(): void;
}

export interface TemplaticalEditor extends TemplaticalEditorBase {
  /**
   * Render the current template to an MJML string. Resolves custom blocks
   * via the editor's internal block registry. Throws if the optional
   * `@templatical/renderer` package is not installed.
   */
  toMjml(): Promise<string>;
  /**
   * Render a single custom block to its HTML representation, using the
   * registered custom block definition's template and the block's current
   * field values. Exposed for headless callers that want to reuse the
   * editor's renderer (e.g., to drive `@templatical/renderer`'s
   * `renderCustomBlock` option from outside the editor instance).
   */
  renderCustomBlock(block: CustomBlock): Promise<string>;
}

/**
 * Cloud editor does not expose `toMjml` or `renderCustomBlock`: the cloud
 * backend performs MJML conversion server-side with additional processing
 * (e.g., signed image URLs, attachment handling) that isn't available client
 * side. Use the cloud `save()` flow to persist content; the backend handles
 * MJML/HTML export from there.
 */
export interface TemplaticalCloudEditor extends TemplaticalEditorBase {
  create(content?: TemplateContent): Promise<Template>;
  load(templateId: string): Promise<Template>;
  save(): Promise<SaveResult>;
}

// ---------------------------------------------------------------------------
// OSS init — sync
// ---------------------------------------------------------------------------

let appInstance: App | null = null;
const editorRef: Ref<InstanceType<typeof Editor> | null> = ref(null);

export async function init(
  config: TemplaticalEditorConfig,
): Promise<TemplaticalEditor> {
  const container =
    typeof config.container === "string"
      ? document.querySelector(config.container)
      : config.container;

  if (!container) {
    throw new Error(
      `[Templatical] Container element not found: ${config.container}`,
    );
  }

  if (appInstance) {
    unmount();
  }

  // Load translations before mounting so child components can use useI18n synchronously
  const translations = await loadTranslations(config.locale ?? "en");

  // Create fonts manager to pass to Editor
  const fontsManager = useFonts(config.fonts);

  appInstance = createApp({
    setup() {
      return () =>
        h(Editor, {
          config,
          translations,
          fontsManager,
          ref: editorRef,
        });
    },
  });

  appInstance.mount(container);

  const instance: TemplaticalEditor = {
    getContent() {
      if (editorRef.value) {
        return JSON.parse(JSON.stringify(editorRef.value.getContent()));
      }
      return JSON.parse(JSON.stringify(config.content));
    },
    setContent(content: TemplateContent) {
      if (editorRef.value) {
        editorRef.value.setContent(content);
      }
      config.content = content;
    },
    setTheme(theme: UiTheme) {
      if (editorRef.value) {
        editorRef.value.setTheme(theme);
      }
    },
    unmount,
    renderCustomBlock(block: CustomBlock) {
      if (!editorRef.value) {
        return Promise.reject(new Error("[Templatical] Editor not ready"));
      }
      return editorRef.value.renderCustomBlock(block);
    },
    toMjml: () => toMjmlForInstance(instance),
  };

  return instance;
}

// ---------------------------------------------------------------------------
// Cloud init — async, flat config, tree-shaken when not called
// ---------------------------------------------------------------------------

let cloudAppInstance: App | null = null;

const cloudEditorRef: Ref<InstanceType<
  typeof import("./cloud/CloudEditor.vue").default
> | null> = ref(null);

export async function initCloud(
  config: import("./cloud/CloudEditor.vue").TemplaticalCloudEditorConfig,
): Promise<TemplaticalCloudEditor> {
  const container =
    typeof config.container === "string"
      ? document.querySelector(config.container)
      : config.container;

  if (!container) {
    throw new Error(
      `[Templatical] Container element not found: ${config.container}`,
    );
  }

  if (cloudAppInstance) {
    unmountCloud();
  }

  // Dynamic import — CloudEditor.vue is tree-shaken from the OSS bundle
  const { default: CloudEditor } = await import("./cloud/CloudEditor.vue");

  // Load translations before mounting so child components can use useI18n synchronously
  const translations = await loadTranslations(config.locale ?? "en");

  // Create fonts manager to pass to CloudEditor
  const fontsManager = useFonts(config.fonts);

  // Promise that resolves when CloudEditor emits 'ready'
  const readyPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("[Templatical] Cloud editor initialization timed out"));
    }, INIT_TIMEOUT_MS);

    cloudAppInstance = createApp({
      setup() {
        return () =>
          h(CloudEditor, {
            config,
            translations,
            fontsManager,
            ref: cloudEditorRef,
            onReady: () => {
              clearTimeout(timeout);
              resolve();
            },
          });
      },
    });

    cloudAppInstance.mount(container);
  });

  await readyPromise;

  const instance: TemplaticalCloudEditor = {
    getContent() {
      if (cloudEditorRef.value) {
        return JSON.parse(JSON.stringify(cloudEditorRef.value.getContent()));
      }
      return JSON.parse(JSON.stringify(config.content));
    },
    setContent(content: TemplateContent) {
      if (cloudEditorRef.value) {
        cloudEditorRef.value.setContent(content);
      }
    },
    setTheme(theme: UiTheme) {
      if (cloudEditorRef.value) {
        cloudEditorRef.value.setTheme(theme);
      }
    },
    unmount: unmountCloud,
    create(content?: TemplateContent) {
      if (!cloudEditorRef.value) {
        return Promise.reject(
          new Error("[Templatical] Cloud editor not ready"),
        );
      }
      return cloudEditorRef.value.create(content);
    },
    load(templateId: string) {
      if (!cloudEditorRef.value) {
        return Promise.reject(
          new Error("[Templatical] Cloud editor not ready"),
        );
      }
      return cloudEditorRef.value.load(templateId);
    },
    save() {
      if (!cloudEditorRef.value) {
        return Promise.reject(
          new Error("[Templatical] Cloud editor not ready"),
        );
      }
      return cloudEditorRef.value.save();
    },
  };

  return instance;
}

// ---------------------------------------------------------------------------
// Unmount helpers
// ---------------------------------------------------------------------------

export function unmount(): void {
  if (appInstance) {
    appInstance.unmount();
    appInstance = null;
    editorRef.value = null;
  }
}

function unmountCloud(): void {
  if (cloudAppInstance) {
    cloudAppInstance.unmount();
    cloudAppInstance = null;
    cloudEditorRef.value = null;
  }
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { TemplaticalCloudEditorConfig } from "./cloud/CloudEditor.vue";
export type {
  BlockDefaults,
  TemplateContent,
  TemplateDefaults,
  ThemeOverrides,
  UiTheme,
  MergeTagsConfig,
  DisplayConditionsConfig,
  CustomBlockDefinition,
  ViewportSize,
  CustomFont,
  FontsConfig,
  SaveResult,
  Template,
} from "@templatical/types";

export type { UseFontsReturn, FontOption } from "./composables/useFonts";
export { useFonts } from "./composables/useFonts";
export type { EditorCapabilities } from "./types/editor-capabilities";
