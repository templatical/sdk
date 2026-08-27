// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- ambient-module declaration must be loaded for cross-package typecheck (workspace path alias resolves to source)
/// <reference path="./virtual-modules.d.ts" />
import { createApp, h, ref, type App, type Ref } from "vue";
import { DEFAULT_AUTO_SAVE_DEBOUNCE_MS } from "@templatical/core";
import type {
  BlockDefaults,
  ColorsConfig,
  CommentsProvider,
  CustomBlock,
  CustomBlockDefinition,
  DisplayConditionsConfig,
  EditorUser,
  FontsConfig,
  LogicTagsConfig,
  MediaResult,
  MergeTagsConfig,
  RenderProvider,
  SavedBlocksProvider,
  TestEmailProvider,
  Template,
  TemplateContent,
  TemplateDefaults,
  TemplatesProvider,
  ThemeOverrides,
  VersionHistoryProvider,
  UiTheme,
  ResolvePreview,
} from "@templatical/types";
import { createDefaultTemplateContent, safeClone } from "@templatical/types";
import type { MediaRequestContext } from "@templatical/media-library";

import Editor from "./Editor.vue";
import type { CloudRuntime } from "./cloud/runtime";
import type { TemplaticalCloudEditorConfig } from "./cloud/cloudConfig";
import type { ResolveImageUrl } from "./composables/useImageUrlResolver";
import { loadTranslations, loadCloudTranslations } from "./i18n";
import { useFonts } from "./composables";
import { toMjmlForInstance } from "./utils/toMjml";
import { normalizeContentForConfig } from "./utils/normalizeMergeTagMarkup";
import {
  buildRenderPayload,
  createRenderMethods,
  resolveRenderFonts,
} from "./utils/renderProvider";
import type { HtmlBlockPreviewConfig } from "./utils/resolveHtmlBlockPreview";
// Compiled-CSS-as-string for shadow root adoption. The `virtual:editor-css`
// module is owned by `scripts/inline-style-css-plugin.ts` — at build time it
// captures every emitted CSS asset (Tailwind utilities + every `.vue` SFC
// `<style>` block + `styles/index.css` rules) and replaces this import's
// runtime value with the full library CSS string. In dev/test the plugin
// returns `styles/index.css` source as a fallback.
//
// Separate concern from the side-effecting `import "./styles/index.css"` in
// `Editor.vue`, which injects styles into `document.head` for light-DOM mode and
// survives untouched.
//
// Ambient declaration for `virtual:editor-css` lives in `virtual-modules.d.ts`
// referenced at the top of this file via triple-slash so it's visible to any
// consumer typechecking through the workspace path alias.
import editorStylesInline from "virtual:editor-css";

// ---------------------------------------------------------------------------
// OSS config + return types
// ---------------------------------------------------------------------------

export interface TemplaticalEditorConfig {
  /**
   * Where to mount the editor — a CSS selector or an `HTMLElement`.
   *
   * Layout caveat: do NOT apply `transform`, `filter`, `perspective`, or
   * `will-change` to an ancestor of this element. Each establishes a CSS
   * containing block for `position: fixed`, which offsets the editor's
   * floating UI (color pickers, rich-text toolbars) and its drag ghost away
   * from their anchor — even when the transform's computed value is `none`
   * (an active/animated transform still promotes the element). For a
   * scroll/entrance effect on a wrapper, animate `opacity` instead of
   * `transform`.
   */
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
  onError?: (error: Error) => void;

  /**
   * Called whenever the editor's unsaved-changes state flips — `true` on the
   * first edit after a save, `false` once a save completes.
   *
   * Works with or without a `templates` provider, because the editor's own
   * `beforeunload` guard cannot cover SPA route changes: an embedded editor's
   * consumer has to guard their router themselves, and this is what they guard
   * it with.
   */
  onDirtyChange?: (isDirty: boolean) => void;

  /**
   * Storage backend for **the template itself** — the save/load lifecycle around
   * whatever is on the canvas.
   *
   * The editor owns the header's name field, save button and save-status
   * indicator, the Cmd+S shortcut, autosave and the unsaved-changes guard; you
   * own persistence. Three methods:
   *
   * ```ts
   * const editor = await init({
   *   container,
   *   templates: {
   *     load: (id) => fetch(`/api/templates/${id}`).then((r) => r.json()),
   *     create: (input) =>
   *       fetch("/api/templates", {
   *         method: "POST",
   *         headers: { "Content-Type": "application/json" },
   *         body: JSON.stringify(input),
   *       }).then((r) => r.json()),
   *     save: (id, patch) =>
   *       fetch(`/api/templates/${id}`, {
   *         method: "PATCH",
   *         headers: { "Content-Type": "application/json" },
   *         body: JSON.stringify(patch),
   *       }).then((r) => r.json()),
   *   },
   * });
   *
   * await editor.load("tpl_123");
   * ```
   *
   * Autosave (`templates.autoSave`), the unsaved-changes guard
   * (`templates.unsavedChangesGuard`) and the header's inline name field
   * (`templates.nameField`) are configured on this same object — grouped here
   * because none of the three mean anything without somewhere to save to.
   *
   * **Omitted by default.** With no provider the feature is entirely off — no
   * name field, no save button, no status indicator — and `create()` / `load()` /
   * `save()` reject with an explanatory error. Persist the content yourself from
   * `onChange` instead; Cmd+S then flushes that notification immediately rather
   * than waiting out the debounce.
   *
   * Opening a template is deliberately imperative: there is no `templateId`
   * config key and no in-editor template browser, because choosing which
   * template to open belongs to your application.
   */
  templates?: TemplatesProvider;

  /**
   * Rendering backend — how the template becomes MJML, and how MJML becomes the
   * HTML you send.
   *
   * Separate from `templates` on purpose: saving and rendering run at different
   * frequencies (autosave would compile MJML on every debounce tick) and fail in
   * different ways. Every method is optional, and `editor.toMjml()` /
   * `editor.toHtml()` resolve each one independently:
   *
   * | Call | Order |
   * |---|---|
   * | `toMjml()` | `render.toMjml` → the bundled `@templatical/renderer` → throw |
   * | `toHtml()` | `render.toHtml` → `toMjml()`'s result + `render.compileMjml` → throw |
   *
   * **Omitted by default**, in which case `toMjml()` renders locally and
   * `toHtml()` rejects — the SDK deliberately bundles no MJML compiler, so there
   * is no local HTML path. One endpoint is enough to close that gap:
   *
   * ```ts
   * init({
   *   container,
   *   render: {
   *     compileMjml: (mjml) =>
   *       fetch("/api/mjml", { method: "POST", body: mjml }).then((r) => r.text()),
   *   },
   * });
   * ```
   *
   * Provider methods receive a **render-complete** payload: custom blocks already
   * resolved to `renderedHtml`, and the editor's effective fonts. Both are things
   * a backend cannot reconstruct from the template JSON alone.
   */
  render?: RenderProvider;

  /**
   * Storage backend for the template's **version history** — the past states a
   * user can browse, preview and restore.
   *
   * The editor owns the header's history control, the preview banner and the
   * restore flow; you own the storage. `list` and `get` are the operations;
   * `create` and `restore` can each be turned off by passing `false` instead of
   * a function.
   *
   * ```ts
   * init({
   *   container,
   *   versionHistory: {
   *     list: (templateId) =>
   *       fetch(`/api/templates/${templateId}/versions`).then((r) => r.json()),
   *     get: (templateId, versionId) =>
   *       fetch(`/api/templates/${templateId}/versions/${versionId}`)
   *         .then((r) => r.json())
   *         .then((v) => v.content),
   *     create: false,
   *     restore: (templateId, versionId) =>
   *       fetch(`/api/templates/${templateId}/versions/${versionId}/restore`, {
   *         method: "POST",
   *       }).then((r) => r.json()),
   *   },
   * });
   * ```
   *
   * **Omitted by default** — the control does not render and none of its UI is
   * downloaded. It also stays hidden until a template is loaded, since a version
   * belongs to a template id.
   *
   * **The editor never records a version by itself.** Whichever
   * `TemplatesProvider.save` you supply decides whether a save also records one,
   * so throttling and retention stay with the side that pays for the storage.
   */
  versionHistory?: VersionHistoryProvider;

  /**
   * How long the editor waits after the last edit before it fires `onChange`
   * and, when `templates.autoSave` is on, saves.
   *
   * One timer drives both, so they cannot drift apart. Set it with no templates
   * provider to pace `onChange` alone.
   *
   * @default 2000
   */
  changeDebounce?: number;

  onRequestMedia?: OnRequestMedia;

  /**
   * Resolves the template for preview surfaces — typically evaluating logic
   * tags (`{% if %}` … `{% endif %}`) against real data on your backend.
   *
   * Called when a preview opens and when the test-email recipient changes,
   * debounced. Display-only: the result never reaches `getContent()`, a send or
   * an export. Rejecting is safe — the preview falls back to the unresolved
   * template and says so.
   *
   * Supersedes `MergeTag.sample` when configured: real data beats example data,
   * so the Sample/Label switch stops rendering.
   */
  resolvePreview?: ResolvePreview;

  /**
   * Display-only resolver for image `src` values. The canvas calls this to
   * obtain a preview URL for a src the user entered; the content model (and
   * `toMjml()` output) always keeps the canonical value. Return `null` — or
   * the input value — to use the src as-is.
   *
   * Use this when templates reference images by a value that isn't directly
   * displayable, e.g. plain file names resolved to ephemeral `blob:` URLs
   * from local storage:
   *
   * ```ts
   * resolveImageUrl: async (src) => {
   *   const file = await fileStore.lookup(src);
   *   return file ? URL.createObjectURL(file) : null;
   * }
   * ```
   *
   * The resolver is called once per committed src value (typing in the src
   * input is debounced, so partial values never reach it) and results are
   * cached per src for the editor's lifetime — including failures, which
   * fall back to displaying the src verbatim. Note the caching applies to
   * transient failures too: a src that failed to resolve stays unresolved
   * until the editor is re-initialized (a re-resolve hook may be added
   * later). Applies to image srcs, design-time placeholder previews, and
   * explicit video thumbnails; auto-derived provider thumbnails (YouTube/
   * Vimeo) are already real URLs and are never resolved.
   */
  resolveImageUrl?: ResolveImageUrl;

  mergeTags?: MergeTagsConfig;
  /**
   * Standalone logic tags — control-flow tokens (`{% else %}`) and open/close
   * pairs (`{% if %}` … `{% endif %}`) inserted from a dedicated "Insert logic"
   * button. Separate from `mergeTags`; typed/pasted logic is highlighted
   * regardless of this config.
   */
  logicTags?: LogicTagsConfig;
  displayConditions?: DisplayConditionsConfig;
  customBlocks?: CustomBlockDefinition[];

  /**
   * Allowlist + order for the block palette. When set, only the listed block
   * types appear in the sidebar palette, in exactly this order — unlisted
   * built-ins (e.g. `video`, `table`) are hidden. When omitted, the full
   * default palette is shown.
   *
   * Reference built-in blocks by their bare type (`'section'`, `'image'`, …)
   * and custom blocks by their `custom:`-prefixed type (`'custom:qrcode'`),
   * so they can be interleaved freely:
   *
   * ```ts
   * paletteBlocks: ['section', 'title', 'image', 'custom:qrcode', 'button']
   * ```
   *
   * Unknown entries — a typo, an unregistered custom block, or `countdown`
   * outside a Cloud plan — are logged with a warning and skipped. Filtering
   * the palette never affects rendering: existing content using a hidden
   * block type still renders correctly.
   */
  paletteBlocks?: string[];

  /**
   * Render each HTML block's raw content as a live preview in the editor
   * canvas instead of the static placeholder card. **Off by default.**
   *
   * ```ts
   * htmlBlockPreview: true                 // shorthand for { enabled: true }
   * htmlBlockPreview: { enabled: true }
   * ```
   *
   * The content is rendered verbatim inside a sandboxed `<iframe>`
   * (`sandbox="allow-same-origin"`, **no** `allow-scripts`): scripts and
   * inline event handlers never execute and styles can't bleed into the rest
   * of the editor. This is a preview-only setting — the MJML/HTML export path
   * renders HTML blocks regardless of it.
   *
   * @default false
   */
  htmlBlockPreview?: HtmlBlockPreviewConfig;

  fonts?: FontsConfig;

  /**
   * Editor-wide color-picker palette. `presets` appear as a clickable grid in
   * every color picker popover (block toolbars, template settings, rich-text
   * color, custom-block color fields) — clicking one applies it, and the preset
   * matching the current value is marked selected.
   *
   * ```ts
   * colors: {
   *   presets: ['#0b5cff', '#111827', '#6b7280', '#ffffff'],
   *   allowCustom: false, // lock authors to the presets above
   * }
   * ```
   *
   * `allowCustom` defaults to `true`. Set it to `false` (together with
   * `presets`) to hide the wheel and hex input so authors can only pick from the
   * palette — useful when embedding the editor as a white-label / brand-kit
   * tool. `allowCustom: false` is ignored, with a warning, when no `presets` are
   * configured, since that would leave the picker with no way to set a color.
   */
  colors?: ColorsConfig;

  /**
   * Storage backend for **saved blocks** — reusable groups of blocks a user
   * saves from the canvas and re-inserts into other templates.
   *
   * The editor owns the UI (a save action on each block, a searchable browser
   * with preview, insert-at-position, rename, delete); you own persistence.
   * Implement the four methods of `SavedBlocksProvider` against your own API,
   * or use the bundled browser-local provider for demos and prototypes:
   *
   * ```ts
   * import { init, createLocalStorageSavedBlocksProvider } from "@templatical/editor";
   *
   * init({ container, savedBlocks: createLocalStorageSavedBlocksProvider() });
   * ```
   *
   * **Omitted by default.** With no provider the feature is entirely off — no
   * save action, no sidebar entry, and none of its UI code is downloaded.
   *
   * Not to be confused with `customBlocks`, which registers developer-defined
   * block *types* with their own templates and field schemas.
   */
  savedBlocks?: SavedBlocksProvider;

  /**
   * Sending backend for **test emails** — letting a user mail themselves the
   * template they're editing.
   *
   * The editor owns the trigger, the dialog, recipient validation and the
   * sending/success/error states; you own delivery. One method is enough:
   *
   * ```ts
   * init({
   *   container,
   *   testEmail: {
   *     send: ({ recipient, content }) =>
   *       fetch("/api/test-email", {
   *         method: "POST",
   *         headers: { "Content-Type": "application/json" },
   *         body: JSON.stringify({ recipient, content }),
   *       }).then((r) => {
   *         if (!r.ok) throw new Error("Could not send the test email");
   *       }),
   *   },
   * });
   * ```
   *
   * **Omitted by default.** With no provider the feature is entirely off — no
   * button, and none of its UI code is downloaded.
   *
   * `allowedRecipients` restricts the picker but is **not** a security boundary:
   * it lives in the user's browser. Validate the recipient on your server.
   */
  testEmail?: TestEmailProvider;

  /**
   * Storage backend for **comments** — the review conversation on a template.
   *
   * The editor owns the panel, the threading, the resolve flow, the per-block
   * indicators and the jump-to-block affordance; you own persistence. Five
   * methods, each mutation turn-off-able by passing `false`:
   *
   * ```ts
   * init({
   *   container,
   *   user: { id: "u_7", name: "Ada" },
   *   comments: {
   *     list: (templateId) =>
   *       fetch(`/api/templates/${templateId}/comments`).then((r) => r.json()),
   *     create: (templateId, input) =>
   *       fetch(`/api/templates/${templateId}/comments`, {
   *         method: "POST",
   *         headers: { "Content-Type": "application/json" },
   *         body: JSON.stringify(input),
   *       }).then((r) => r.json()),
   *     update: (templateId, commentId, patch) =>
   *       fetch(`/api/templates/${templateId}/comments/${commentId}`, {
   *         method: "PATCH",
   *         headers: { "Content-Type": "application/json" },
   *         body: JSON.stringify(patch),
   *       }).then((r) => r.json()),
   *     delete: async (templateId, commentId) => {
   *       await fetch(`/api/templates/${templateId}/comments/${commentId}`, {
   *         method: "DELETE",
   *       });
   *     },
   *     setResolved: (templateId, commentId, resolved) =>
   *       fetch(`/api/templates/${templateId}/comments/${commentId}/resolve`, {
   *         method: "POST",
   *         headers: { "Content-Type": "application/json" },
   *         body: JSON.stringify({ resolved }),
   *       }).then((r) => r.json()),
   *   },
   * });
   * ```
   *
   * **Requires {@link user}** — with no identity the feature reports itself
   * unavailable and nothing renders, rather than writing anonymous comments.
   *
   * **Omitted by default**, and the panel also stays hidden until a template is
   * loaded, since a comment belongs to a template id.
   *
   * The same object also carries outward events — `onCreated`, `onUpdated`,
   * `onDeleted`, `onResolved`, `onUnresolved` — each called with the comment and
   * whether the change was made locally or arrived through `subscribe`. That's
   * the hook for a "3 new comments" badge outside the editor.
   *
   * Realtime is an optional `subscribe` on the provider, not a prerequisite:
   * without it comments work identically, you simply see a colleague's on the next
   * read rather than immediately.
   */
  comments?: CommentsProvider;

  /**
   * Who is using the editor — needed by any feature that attributes work to a
   * person. Today that is {@link comments}; collaboration presence will want the
   * same answer, which is why this is a top-level key rather than part of the
   * comments provider.
   *
   * ```ts
   * init({ container, user: { id: "u_7", name: "Ada Lovelace" } });
   * ```
   *
   * Not a security boundary — it identifies the user to the editor's UI, in the
   * user's own browser. Attribute writes server-side from the session your backend
   * already trusts.
   */
  user?: EditorUser;

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
   * Show a "use a larger screen" notice instead of the editor chrome on
   * viewports narrower than ~768px. Defaults to `true`.
   *
   * The drag-and-drop editor is a desktop-class tool — the block palette,
   * canvas, and properties panel can't lay out usably on a phone, and touch
   * dragging is impractical. Rather than render a broken, cramped layout, the
   * editor shows a clear message below the breakpoint.
   *
   * Set to `false` if you handle small screens yourself (e.g. you embed the
   * editor in a deliberately narrow desktop pane). The check is viewport-based,
   * so it targets actual small devices, not narrow containers on a wide screen.
   *
   * @default true
   */
  smallScreenNotice?: boolean;

  /**
   * Template linter (`@templatical/quality`) configuration. Runs every
   * linter exported by the package (accessibility + structure).
   *
   * - When unset, the linter loads on demand once the user opens the panel.
   * - When `disabled: true`, the optional peer is never imported (saves the
   *   chunk download) and the sidebar tab + inline badges are suppressed.
   * - `rules`/`thresholds` follow the shape exported by `@templatical/quality`.
   */
  lint?: import("@templatical/quality").LintOptions;
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
  /**
   * Render the current template to MJML.
   *
   * Resolves `render.toMjml` first when a `render` provider supplies it, then the
   * bundled `@templatical/renderer` (which resolves custom blocks through the
   * editor's own registry). Rejects with a clear error when neither is available —
   * i.e. no provider method *and* the optional `@templatical/renderer` peer isn't
   * installed.
   */
  toMjml(): Promise<string>;
  /**
   * Render the current template to sending-ready HTML.
   *
   * Resolves `render.toHtml` first, then `toMjml()`'s output through
   * `render.compileMjml`. **Requires one of the two** — the SDK bundles no MJML
   * compiler, so with no `render` provider this always rejects, and the error says
   * which method to add.
   */
  toHtml(): Promise<string>;
}

export interface TemplaticalEditor extends TemplaticalEditorBase {
  /**
   * Persist the current content as a new template through the configured
   * `templates` provider, and make the result the editor's template.
   *
   * `input.content`, when given, replaces the editor's content first. Always
   * present on the type; rejects with an explanatory error when no provider is
   * configured or when the provider set `create: false` — the same convention as
   * {@link toMjml}.
   */
  create(input?: {
    name?: string;
    content?: TemplateContent;
  }): Promise<Template>;
  /** Load a template by id and make it the editor's content. */
  load(templateId: string): Promise<Template>;
  /**
   * Persist the loaded template — name and content, as one patch. Rejects when
   * no provider is configured, when the provider set `save: false`, or when no
   * template has been created or loaded yet.
   */
  save(): Promise<Template>;
  /**
   * Whether there are edits the editor knows aren't persisted. Cleared by a
   * successful `save()` / `create()` / `load()`.
   *
   * Read it in a router guard; `onDirtyChange` is the push-based counterpart.
   */
  isDirty(): boolean;
  /**
   * Render a single custom block to its HTML representation, using the
   * registered custom block definition's template and the block's current
   * field values. Exposed for headless callers that want to reuse the
   * editor's renderer (e.g., to drive `@templatical/renderer`'s
   * `renderCustomBlock` option from outside the editor instance).
   */
  renderCustomBlock(block: CustomBlock): Promise<string>;
  /**
   * Look up the definition-level `stylesheet` for a registered custom block
   * type. Returns the raw CSS string, or `undefined` when the type is unknown
   * or the definition has no stylesheet. Exposed for headless callers that
   * want to drive `@templatical/renderer`'s `getCustomBlockStylesheet` option
   * from outside the editor instance.
   */
  getCustomBlockStylesheet(customType: string): string | undefined;
}

/**
 * `initCloud()` returns the **same** editor `init()` does.
 *
 * That is the point rather than a tidy-up: Cloud is a set of provider
 * implementations behind the same interfaces a consumer would implement, so if
 * the two entry points still returned different shapes, the claim would be
 * false. It also means moving between them is a config change and never a
 * rewrite of the calling code.
 *
 * Three cloud-only members went with the convergence: `create()` takes
 * `init()`'s `{ name?, content? }` input object now, rather than a bare
 * `TemplateContent`; `setThemeOverrides` is gone (`config.theme` is applied
 * at init on both entry points, and the entitlement that gated changing it
 * later is gone); and `sendTestEmail` is gone (the shared dialog is the
 * supported path).
 */
export type TemplaticalCloudEditor = TemplaticalEditor;

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
  return mountEditor(config);
}

/**
 * The one mount path. `init()` calls it with no runtime; `initCloud()` calls it
 * with Cloud's, having already resolved auth, the plan and every adapter.
 */
async function mountEditor(
  config: TemplaticalEditorConfig,
  cloud?: CloudRuntime,
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

  // Merge tags reach us in one of two shapes, and only one of them behaves like
  // a tag. Anything typed or pasted is already a `<span data-merge-tag>`, since
  // `MergeTagNode`'s input rules convert it on the spot; content that arrived
  // any other way — a consumer's stored JSON, an `@templatical/import-*`
  // conversion — still holds bare `{{tokens}}` that render as plain text.
  // Normalizing here, before the seed reaches `Editor.vue`, means core is
  // handed content that is already correct and never observes a mutation, so
  // nothing is marked dirty and no autosave tick fires for a load.
  //
  // This is one of four places content enters. The other three:
  // `instance.setContent` and `instance.create` below, and the `templates`
  // provider's `load`, wrapped in `Editor.vue` where it reaches core.
  if (config.content) {
    config.content = normalizeContentForConfig(
      config.content,
      config.mergeTags,
    );
  }

  const app = createApp({
    setup() {
      return () =>
        h(Editor, {
          config,
          translations,
          fontsManager,
          shadowRoot: mount.shadowRoot ?? undefined,
          cloud,
          ref: editorRef,
        });
    },
  });

  app.mount(mount.target);

  ossEntries.set(container, { app, editorRef, cleanup: mount.cleanup });
  lastOssContainer = container;

  const instance: TemplaticalEditor = {
    getContent() {
      // safeClone (not a naked JSON.stringify): a drag inside a section can
      // leave a Sortable expando cycle reachable from live content, which a
      // plain stringify chokes on (#203). The clone drops the back-ref.
      if (editorRef.value) {
        return safeClone(editorRef.value.getContent());
      }
      return safeClone(config.content ?? createDefaultTemplateContent());
    },
    setContent(content: TemplateContent) {
      // Normalized once and used for both writes: `getContent()` falls back to
      // `config.content` before mount, so a raw write-back here would hand back
      // different content than the mounted editor holds.
      const normalized = normalizeContentForConfig(content, config.mergeTags);
      if (editorRef.value) {
        editorRef.value.setContent(normalized);
      }
      config.content = normalized;
    },
    setTheme(theme: UiTheme) {
      if (editorRef.value) {
        editorRef.value.setTheme(theme);
      }
    },
    unmount: () => unmountOssContainer(container),
    create(input?: { name?: string; content?: TemplateContent }) {
      if (!editorRef.value) {
        return Promise.reject(new Error("[Templatical] Editor not ready"));
      }
      // Supplied content becomes editor state before the provider is called,
      // so it is consumer content arriving in and gets the same treatment as
      // `setContent`. A contentless create is forwarded as-is — core then
      // persists the state it already holds, which is normalized already.
      return editorRef.value.create(
        input?.content
          ? {
              ...input,
              content: normalizeContentForConfig(
                input.content,
                config.mergeTags,
              ),
            }
          : input,
      );
    },
    load(templateId: string) {
      if (!editorRef.value) {
        return Promise.reject(new Error("[Templatical] Editor not ready"));
      }
      return editorRef.value.load(templateId);
    },
    save() {
      if (!editorRef.value) {
        return Promise.reject(new Error("[Templatical] Editor not ready"));
      }
      return editorRef.value.save();
    },
    isDirty() {
      // Pre-mount there is nothing the editor could have changed, so the honest
      // answer is "no unsaved edits" rather than a throw.
      return editorRef.value?.isDirty() ?? false;
    },
    renderCustomBlock(block: CustomBlock) {
      if (!editorRef.value) {
        return Promise.reject(new Error("[Templatical] Editor not ready"));
      }
      return editorRef.value.renderCustomBlock(block);
    },
    getCustomBlockStylesheet(customType: string) {
      // Pre-mount: registry is empty, so no definition has a stylesheet to
      // resolve. Returning undefined here matches the "unknown type" branch
      // and keeps the renderer's `getCustomBlockStylesheet` resolver total.
      if (!editorRef.value) {
        return undefined;
      }
      return editorRef.value.getCustomBlockStylesheet(customType);
    },
    toMjml: () => render.toMjml(),
    toHtml: () => render.toHtml(),
  };

  // Both methods resolve per call, so a provider added later in the config — or a
  // provider that implements only one method — behaves the same as one that
  // implements all three. `instance` is captured lazily, which is what lets the
  // payload builder read the editor's live content.
  const render = createRenderMethods({
    provider: config.render,
    buildPayload: () =>
      buildRenderPayload({
        getContent: () => instance.getContent(),
        renderCustomBlock: (block: CustomBlock) =>
          instance.renderCustomBlock(block),
        getFonts: () => resolveRenderFonts(fontsManager),
      }),
    renderLocalMjml: () =>
      toMjmlForInstance({
        getContent: () => instance.getContent(),
        renderCustomBlock: (block: CustomBlock) =>
          instance.renderCustomBlock(block),
        getCustomBlockStylesheet: (customType: string) =>
          instance.getCustomBlockStylesheet(customType),
        getFonts: () => resolveRenderFonts(fontsManager),
      }),
  });

  return instance;
}

// ---------------------------------------------------------------------------
// Cloud init — a thin adapter-wiring wrapper over init()
// ---------------------------------------------------------------------------

/**
 * Mount the editor against Templatical Cloud.
 *
 * **This is `init()` with Cloud's adapters filled in**, and deliberately nothing
 * more. Templates, rendering and version history are providers, so Cloud's entry
 * point is adapter wiring rather than a second editor:
 *
 * 1. Build the auth manager and complete the handshake.
 * 2. Health-check the API, and fetch the plan config.
 * 3. Build Cloud's adapters over that auth manager.
 * 4. Delegate to `init()`.
 *
 * A failure in steps 1–2 **rejects**, rather than mounting an editor that shows
 * an error overlay. That is the one place the wrapper is genuinely not `init()`:
 * `init()` cannot fail after it mounts, and OSS should not grow the ability. A
 * session that dies *later* — an auth refresh that cannot renew the token — does
 * still surface as an overlay, because by then there is an editor to cover.
 *
 * `templates`, `comments` and `versionHistory` are all keyed to a template
 * id Cloud issued, which also anchors collaboration, AI rewrite, scoring and
 * the server-side export — a store Cloud never issued ids for would degrade
 * all of them silently. Cloud therefore keeps each key's storage, but each
 * key is still accepted, for its configuration and events:
 * `templates.load`/`create`/`save`,
 * `comments.list`/`create`/`update`/`delete`/`setResolved`, and
 * `versionHistory.list`/`get`/`create`/`restore` are ignored with a warning
 * naming them, while `templates`' `autoSave`, `unsavedChangesGuard`,
 * `nameField`, `onSaved`, `onCreated`, `onLoaded`, `comments`' `onCreated`,
 * `onUpdated`, `onDeleted`, `onResolved`, `onUnresolved`, and
 * `versionHistory`'s `onCreated`, `onRestored` are all honoured.
 *
 * `render` is not a key here at all, unlike `init()` — Cloud renders
 * server-side for test email, sends and exports, so a supplied renderer
 * would change only what you preview and export, never what Cloud delivers.
 * `resolvePreview` is the same key with the same type on both entry points,
 * so upgrading an OSS integration is a deletion. `savedBlocks` and
 * `testEmail` are the same key on both entry points too, but Cloud widens
 * each type to also accept an events-only shape — `boolean |
 * SavedBlocksOptions | SavedBlocksProvider` and `Pick<TestEmailOptions,
 * "onSent" | "defaultRecipient"> | TestEmailProvider` — so upgrading is
 * still a deletion: drop the key to adopt Cloud's store or sender, or leave
 * it exactly as it is to keep your own.
 *
 * `user` is not a key either: Cloud signs comment writes against the auth token's
 * `user` claim, so it fills `init({ user })` from there rather than letting a
 * browser name someone else.
 */
export async function initCloud(
  config: TemplaticalCloudEditorConfig,
): Promise<TemplaticalCloudEditor> {
  // Dynamic imports — every cloud module is tree-shaken from the OSS bundle, and
  // an OSS consumer who never calls this downloads none of it.
  const [{ bootstrapCloud }, cloudTranslations] = await Promise.all([
    import("./cloud/createCloudRuntime"),
    loadCloudTranslations(config.locale ?? "en"),
  ]);

  const { runtime, providers, user } = await bootstrapCloud({
    config,
    cloudTranslations,
  });

  return mountEditor(
    {
      container: config.container,
      content: config.content,
      shadowDom: config.shadowDom,
      locale: config.locale,
      uiTheme: config.uiTheme,
      theme: config.theme,
      branding: config.branding,
      smallScreenNotice: config.smallScreenNotice,
      blockDefaults: config.blockDefaults,
      templateDefaults: config.templateDefaults,
      customBlocks: config.customBlocks,
      paletteBlocks: config.paletteBlocks,
      htmlBlockPreview: config.htmlBlockPreview,
      colors: config.colors,
      fonts: config.fonts,
      mergeTags: config.mergeTags,
      logicTags: config.logicTags,
      displayConditions: config.displayConditions,
      resolvePreview: config.resolvePreview,
      lint: config.lint,
      onChange: config.onChange,
      onError: config.onError,
      onDirtyChange: config.onDirtyChange,
      // Cloud's adapters, behind the very keys a consumer would fill in
      // themselves. `savedBlocks` is absent when the consumer passed `false`.
      // `templates` spreads Cloud's own provider first so its load/create/save
      // always win over a consumer's config. Autosave defaults on here, unlike
      // `init()`, because Cloud always has a store to save to; the debounce
      // falls back to the same shared constant `useAutoSave` already defaults
      // to, made explicit so a consumer's own `changeDebounce` reaches it.
      templates: {
        ...providers.templates,
        autoSave: config.templates?.autoSave ?? true,
        unsavedChangesGuard: config.templates?.unsavedChangesGuard,
        nameField: config.templates?.nameField,
      },
      changeDebounce: config.changeDebounce ?? DEFAULT_AUTO_SAVE_DEBOUNCE_MS,
      render: providers.render,
      versionHistory: providers.versionHistory,
      savedBlocks: providers.savedBlocks,
      testEmail: providers.testEmail,
      comments: providers.comments,
      // From the JWT. Undefined when the project's token carries no `user` claim,
      // which leaves comments unavailable rather than anonymous.
      user,
    },
    runtime,
  );
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

export type { TemplaticalCloudEditorConfig } from "./cloud/cloudConfig";
export type {
  BlockDefaults,
  TemplateContent,
  TemplateDefaults,
  ThemeOverrides,
  UiTheme,
  MergeTagsConfig,
  LogicTagsConfig,
  LogicTag,
  LogicPair,
  DisplayConditionsConfig,
  CustomBlockDefinition,
  ViewportSize,
  ColorsConfig,
  CustomFont,
  FontsConfig,
  RenderPayload,
  RenderProvider,
  SavedBlock,
  SavedBlocksListParams,
  SavedBlocksOptions,
  SavedBlocksProvider,
  Template,
  TemplatePatch,
  TemplatesOptions,
  TemplateSaveTrigger,
  TemplatesProvider,
  TestEmailOptions,
  TestEmailPayload,
  TestEmailProvider,
  VersionHistoryOptions,
  CommentsOptions,
  CommentEventMeta,
} from "@templatical/types";

// Bundled browser-local saved-blocks provider. Re-exported here (rather than
// leaving it to `@templatical/core`) because consumers install only this
// package — core is bundled inline and isn't resolvable on their side.
export { createLocalStorageSavedBlocksProvider } from "@templatical/core";
export type { LocalStorageSavedBlocksOptions } from "@templatical/core";

export type { ResolveImageUrl } from "./composables/useImageUrlResolver";
export type { UseFontsReturn, FontOption } from "./composables/useFonts";
export { useFonts } from "./composables/useFonts";
export type { EditorCapabilities } from "./types/editor-capabilities";
export type { HtmlBlockPreviewConfig } from "./utils/resolveHtmlBlockPreview";

export {
  getSupportedLocales,
  getSupportedCloudLocales,
  isLocaleSupported,
  isCloudLocaleSupported,
  getBaseLocale,
} from "./i18n";
