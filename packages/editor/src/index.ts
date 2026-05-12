// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- ambient-module declaration must be loaded for cross-package typecheck (workspace path alias resolves to source)
/// <reference path="./virtual-modules.d.ts" />
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
import { loadTranslations, loadCloudTranslations } from "./i18n";
import { useFonts } from "./composables";
import { toMjmlForInstance } from "./utils/toMjml";
// Compiled-CSS-as-string for shadow root adoption. The `virtual:editor-css`
// module is owned by `scripts/inline-style-css-plugin.ts` — at build time it
// captures every emitted CSS asset (Tailwind utilities + every `.vue` SFC
// `<style>` block + `styles/index.css` rules) and replaces this import's
// runtime value with the full library CSS string. In dev/test the plugin
// returns `styles/index.css` source as a fallback.
//
// Separate concern from the side-effecting `import "./styles/index.css"` in
// `Editor.vue` / `CloudEditor.vue`, which injects styles into `document.head`
// for light-DOM mode and survives untouched.
//
// Ambient declaration for `virtual:editor-css` lives in `virtual-modules.d.ts`
// referenced at the top of this file via triple-slash so it's visible to any
// consumer typechecking through the workspace path alias.
import editorStylesInline from "virtual:editor-css";

// ---------------------------------------------------------------------------
// OSS config + return types
// ---------------------------------------------------------------------------

export interface TemplaticalEditorConfig {
  container: string | HTMLElement;
  content?: TemplateContent;

  /**
   * Mount the editor inside a Shadow DOM (open mode) for CSS isolation
   * from the host page. Defaults to `true` — host stylesheets cannot
   * cascade past the shadow boundary into editor elements (`p`, `a`,
   * `input`, etc.), and editor utility classes never collide with host
   * class names.
   *
   * Set to `false` to mount in light DOM. Opt out when:
   *  - Your host integration uses `document.querySelector` to reach
   *    editor internals (with shadow DOM, use `container.shadowRoot
   *    .querySelector(...)` instead).
   *  - You need to support Firefox <101 or Safari <16.4, which lack the
   *    `adoptedStyleSheets` API the shadow path relies on.
   *
   * Light-mode consumers should keep this set to `false` explicitly so
   * future SDK changes don't silently flip the default again.
   *
   * @default true
   */
  shadowDom?: boolean;

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

  /**
   * Accessibility linter (`@templatical/quality`) configuration.
   *
   * - When unset, the linter loads on demand once the user opens the panel.
   * - When `disabled: true`, the optional peer is never imported (saves the
   *   chunk download) and the sidebar tab + inline badges are suppressed.
   * - `rules`/`thresholds` follow the shape exported by `@templatical/quality`.
   */
  accessibility?: import("@templatical/quality").A11yOptions;
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
// Shadow root helpers
// ---------------------------------------------------------------------------

/**
 * Module-cached `CSSStyleSheet` built once from the inline editor CSS string.
 * `adoptedStyleSheets` accepts the same sheet object across multiple shadow
 * roots — sharing one sheet costs zero per-instance memory, regardless of
 * how many editors mount.
 */
let cachedEditorStyleSheet: CSSStyleSheet | null = null;
function getEditorStyleSheet(): CSSStyleSheet {
  if (cachedEditorStyleSheet === null) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(editorStylesInline);
    cachedEditorStyleSheet = sheet;
  }
  return cachedEditorStyleSheet;
}

interface MountTarget {
  target: Element;
  shadowRoot: ShadowRoot | null;
  /**
   * Disposer for any dev-mode side effects attached to the shadow root
   * (currently: the document.head `<style>` mirror's MutationObserver).
   * Always safe to call — no-op when no side effects were registered.
   */
  cleanup: () => void;
}

/**
 * Dev-only: mirror every `<style>` tag in `document.head` into the
 * shadow root's `adoptedStyleSheets`, and observe `document.head` so
 * Vite's HMR-injected style updates flow through to the shadow root
 * automatically.
 *
 * Background: Vite dev injects each `.vue` `<style scoped>` block as a
 * separate `<style>` element in `document.head` via HMR. Those don't
 * cross the shadow boundary, so a shadow-mounted editor in dev would
 * render with only the bundled `styles/index.css` rules — every SFC
 * scoped style (block selection outlines, sidebar layout, etc.) missing.
 *
 * In production builds, `inline-style-css-plugin.ts` captures every
 * emitted CSS asset at `generateBundle` time and inlines the full
 * library CSS as a single string adopted by the shadow root. This
 * dev-only mirror does the same thing at runtime by observing whatever
 * Vite ends up injecting.
 *
 * The dead-code-elimination on `import.meta.env.DEV` ensures the
 * observer + filter logic is stripped from production bundles entirely.
 *
 * Caveats:
 *   - In a real consumer's Vite-dev environment, this would also adopt
 *     the consumer's page-level styles (whatever they put in
 *     `document.head`). That's harmless when consumers install the
 *     editor from npm dist (the dev branch is dead-coded out). It only
 *     matters when a consumer source-resolves this package, which is
 *     unusual outside this repo's own playground.
 *   - `replaceSync` strips `@import` rules per the CSSOM spec. Styles
 *     containing `@import` are skipped silently (the catch below). The
 *     primary bundled sheet covers Tailwind imports already, so this
 *     should never matter in practice.
 */
function attachDevStyleMirror(shadowRoot: ShadowRoot): () => void {
  if (!import.meta.env?.DEV) return () => {};

  function buildSheets(): CSSStyleSheet[] {
    const sheets: CSSStyleSheet[] = [];
    // shadow-ok: dev-only HMR style mirror (production path is plugin-driven via adoptedStyleSheets)
    document.head.querySelectorAll("style").forEach((el) => {
      const text = el.textContent;
      if (!text) return;
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(text);
        sheets.push(sheet);
      } catch {
        // Skip styles that contain disallowed constructs (e.g. `@import`).
      }
    });
    return sheets;
  }

  function refresh(): void {
    // Keep the editor's primary (bundled) sheet first so its declarations
    // are the cascade fallback; dev sheets adopted after may override them
    // — same precedence model as production where everything ends up in
    // one stylesheet anyway.
    shadowRoot.adoptedStyleSheets = [getEditorStyleSheet(), ...buildSheets()];
  }

  refresh();

  const observer = new MutationObserver(() => refresh());
  // childList catches new/removed <style> tags; characterData + subtree
  // catches Vite HMR mutating an existing style's textContent in place.
  // shadow-ok: dev-only HMR style mirror observer
  observer.observe(document.head, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  return () => observer.disconnect();
}

/**
 * Resolve where Vue should mount: directly on the consumer's container
 * (light-DOM mode) or on a fresh `<div>` inside a newly-attached open
 * shadow root (shadow mode). In shadow mode, also attaches the editor's
 * cached `CSSStyleSheet` to the root so chrome renders with the right
 * styles inside the boundary, plus a dev-only mirror that observes
 * `document.head` (see `attachDevStyleMirror`).
 *
 * Idempotent: a second call on the same container reuses any existing
 * shadow root, clearing its contents so a prior mount's stale DOM doesn't
 * accumulate.
 */
function resolveMountTarget(
  container: Element,
  shadowDom: boolean | undefined,
): MountTarget {
  if (!shadowDom) {
    return { target: container, shadowRoot: null, cleanup: () => {} };
  }

  const shadowRoot =
    container.shadowRoot ?? container.attachShadow({ mode: "open" });

  // Adopt the editor stylesheet. Idempotent — repeated assignment of the
  // same sheet is fine. Dev mirror (below) will overwrite this with the
  // primary sheet + mirrored sheets, then keep them in sync.
  shadowRoot.adoptedStyleSheets = [getEditorStyleSheet()];

  // Clear stale content from a prior mount (re-init on same container).
  while (shadowRoot.firstChild) {
    shadowRoot.removeChild(shadowRoot.firstChild);
  }

  const host = document.createElement("div");
  host.className = "tpl-editor-host";
  // Match the container's layout. Without an explicit size the host is a
  // default block element (height: auto) and the editor's `tpl:h-full`
  // template root collapses to content height because the height-100% chain
  // breaks at the shadow boundary. `width: 100%` is redundant for block
  // elements but harmless and explicit.
  host.style.cssText = "display:block;height:100%;width:100%;";
  shadowRoot.appendChild(host);

  const cleanup = attachDevStyleMirror(shadowRoot);

  return { target: host, shadowRoot, cleanup };
}

// ---------------------------------------------------------------------------
// OSS init — sync
// ---------------------------------------------------------------------------

interface OssEntry {
  app: App;
  editorRef: Ref<InstanceType<typeof Editor> | null>;
  /** Tear down dev-mode side effects (style mirror observer, etc.). */
  cleanup: () => void;
}

// Per-container registry so two `init()` calls with different containers
// produce independent editor instances (multi-instance support). Re-init
// on the same container still auto-unmounts the previous instance.
const ossEntries = new Map<Element, OssEntry>();

// "Last init'd" container preserves the legacy single-instance behavior
// of the top-level `unmount()` export — the playground (and other one-
// editor consumers) calls bare `unmount()` and expects it to tear down
// whatever was most recently mounted.
let lastOssContainer: Element | null = null;

function unmountOssContainer(container: Element): void {
  const entry = ossEntries.get(container);
  if (!entry) return;
  entry.cleanup();
  entry.app.unmount();
  ossEntries.delete(container);
  if (lastOssContainer === container) {
    lastOssContainer = null;
  }
}

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

  // Load translations before mounting so child components can use useI18n synchronously
  const translations = await loadTranslations(config.locale ?? "en");

  // Create fonts manager to pass to Editor
  const fontsManager = useFonts(config.fonts);

  // Auto-unmount any prior instance on the SAME container *after* awaits
  // — checking before the await would let two concurrent init() calls
  // both pass the guard and orphan the first-mounted app on this
  // container.
  unmountOssContainer(container);

  const mount = resolveMountTarget(container, config.shadowDom ?? true);
  const editorRef: Ref<InstanceType<typeof Editor> | null> = ref(null);

  const app = createApp({
    setup() {
      return () =>
        h(Editor, {
          config,
          translations,
          fontsManager,
          shadowRoot: mount.shadowRoot ?? undefined,
          ref: editorRef,
        });
    },
  });

  app.mount(mount.target);

  ossEntries.set(container, { app, editorRef, cleanup: mount.cleanup });
  lastOssContainer = container;

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
    unmount: () => unmountOssContainer(container),
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

interface CloudEntry {
  app: App;
  editorRef: Ref<InstanceType<
    typeof import("./cloud/CloudEditor.vue").default
  > | null>;
  cleanup: () => void;
}

const cloudEntries = new Map<Element, CloudEntry>();
let lastCloudContainer: Element | null = null;

function unmountCloudContainer(container: Element): void {
  const entry = cloudEntries.get(container);
  if (!entry) return;
  entry.cleanup();
  entry.app.unmount();
  cloudEntries.delete(container);
  if (lastCloudContainer === container) {
    lastCloudContainer = null;
  }
}

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

  // Dynamic import — CloudEditor.vue is tree-shaken from the OSS bundle
  const { default: CloudEditor } = await import("./cloud/CloudEditor.vue");

  // Load OSS + cloud translations in parallel so child components can use
  // useI18n / useCloudI18n synchronously
  const [translations, cloudTranslations] = await Promise.all([
    loadTranslations(config.locale ?? "en"),
    loadCloudTranslations(config.locale ?? "en"),
  ]);

  // Create fonts manager to pass to CloudEditor
  const fontsManager = useFonts(config.fonts);

  // Auto-unmount any prior instance on the SAME container *after* awaits
  // — checking before the await would let two concurrent initCloud()
  // calls both pass the guard and orphan the first-mounted app on this
  // container.
  unmountCloudContainer(container);

  const mount = resolveMountTarget(container, config.shadowDom ?? true);
  const cloudEditorRef: CloudEntry["editorRef"] = ref(null);

  // Promise that resolves when CloudEditor emits 'ready'
  const readyPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("[Templatical] Cloud editor initialization timed out"));
    }, INIT_TIMEOUT_MS);

    const app = createApp({
      setup() {
        return () =>
          h(CloudEditor, {
            config,
            translations,
            cloudTranslations,
            fontsManager,
            shadowRoot: mount.shadowRoot ?? undefined,
            ref: cloudEditorRef,
            onReady: () => {
              clearTimeout(timeout);
              resolve();
            },
          });
      },
    });

    app.mount(mount.target);

    cloudEntries.set(container, {
      app,
      editorRef: cloudEditorRef,
      cleanup: mount.cleanup,
    });
    lastCloudContainer = container;
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
    unmount: () => unmountCloudContainer(container),
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

/**
 * Unmount the most-recently-created OSS editor. Single-instance legacy
 * API — callers managing multiple editors should use `instance.unmount()`
 * from each returned object, which targets the specific container.
 */
export function unmount(): void {
  if (lastOssContainer) {
    unmountOssContainer(lastOssContainer);
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

export {
  getSupportedLocales,
  getSupportedCloudLocales,
  isLocaleSupported,
  isCloudLocaleSupported,
  getBaseLocale,
} from "./i18n";
