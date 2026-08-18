import type {
  AiConfig,
  BlockDefaults,
  CollaborationConfig,
  ColorsConfig,
  CommentEvent,
  CustomBlockDefinition,
  DisplayConditionsConfig,
  FontsConfig,
  LogicTagsConfig,
  McpConfig,
  MergeTagsConfig,
  SavedBlocksProvider,
  Template,
  TestEmailProvider,
  TemplateContent,
  TemplateDefaults,
  ThemeOverrides,
  UiTheme,
  ResolvePreview,
} from "@templatical/types";
import type {
  MediaItem,
  MediaRequestContext,
} from "@templatical/media-library";
import type { HtmlBlockPreviewConfig } from "../utils/resolveHtmlBlockPreview";
import type { AutoSaveConfig } from "../types/auto-save";

export interface TemplaticalCloudEditorConfig {
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

  auth: {
    url: string;
    baseUrl?: string;
    requestOptions?: {
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
      credentials?: RequestCredentials;
    };
  };

  theme?: ThemeOverrides;
  uiTheme?: UiTheme;
  locale?: string;

  /**
   * Show the "Powered by Templatical" footer. Defaults to `true`.
   * Set to `false` to hide the footer (no attribution required by the license).
   * Cloud white-label plans hide the footer regardless of this setting.
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

  ai?: AiConfig | false;
  commenting?: boolean;
  collaboration?: CollaborationConfig;
  mcp?: McpConfig;
  blockDefaults?: BlockDefaults;
  templateDefaults?: TemplateDefaults;

  /**
   * Reusable saved blocks.
   *
   * - **omitted / `true`** — backed by Templatical Cloud, gated on the
   *   `saved_modules` plan feature.
   * - **`false`** — off entirely; no UI renders.
   * - **a {@link SavedBlocksProvider}** — backed by *your* store instead of
   *   Cloud's, and **not plan-gated**, because the plan feature licenses Cloud's
   *   storage rather than the editor's UI.
   *
   * The provider form is the same type `init()` takes, so moving an OSS
   * integration to Cloud means deleting this key (to adopt Cloud's store) or
   * leaving it exactly as-is (to keep your own) — never rewriting it.
   */
  savedBlocks?: boolean | SavedBlocksProvider;
  /**
   * Save automatically, debounced. **The same key and the same type as
   * `init()`** — `true`/`false`, or `{ debounce }` to set the cadence in one
   * key. Unlike OSS it defaults to *on*, because a Cloud session always has a
   * store to save to.
   */
  autoSave?: AutoSaveConfig;

  mergeTags?: MergeTagsConfig;
  logicTags?: LogicTagsConfig;
  displayConditions?: DisplayConditionsConfig;
  customBlocks?: CustomBlockDefinition[];

  /**
   * Allowlist + order for the block palette. When set, only the listed block
   * types appear in the sidebar palette, in this order; unlisted built-ins are
   * hidden. Built-ins use their bare type (`'image'`), custom blocks the
   * `custom:`-prefixed type (`'custom:qrcode'`). Unknown entries are warned and
   * skipped. Omit for the full default palette. See `paletteBlocks` on the OSS
   * editor config for details.
   */
  paletteBlocks?: string[];

  /**
   * Render each HTML block's raw content as a live preview in the editor
   * canvas instead of the static placeholder card. **Off by default.** Accepts
   * `true` (shorthand for `{ enabled: true }`) or `{ enabled: boolean }`.
   *
   * Content is rendered verbatim inside a sandboxed `<iframe>`
   * (`sandbox="allow-same-origin"`, no `allow-scripts`), so scripts never run
   * and styles can't bleed. Preview-only — export is unaffected. See
   * `htmlBlockPreview` on the OSS editor config for details.
   *
   * @default false
   */
  htmlBlockPreview?: HtmlBlockPreviewConfig;

  fonts?: FontsConfig;

  /**
   * Editor-wide color-picker palette. `presets` render as a clickable grid in
   * every color picker popover; `allowCustom: false` (with `presets`) hides the
   * wheel and hex input so authors can only pick from the palette. Ignored with
   * a warning when no `presets` are configured. See `colors` on the OSS editor
   * config for details and an example.
   */
  colors?: ColorsConfig;
  onChange?: (content: TemplateContent) => void;
  /**
   * Called whenever the editor's unsaved-changes state flips. **The same key and
   * the same type as `init()`'s** — one editor, one set of keys.
   */
  onDirtyChange?: (isDirty: boolean) => void;
  /**
   * Warn before closing the tab with unsaved changes. On by default, since a
   * Cloud session always has a store to save to. Set to `false` to own the
   * prompt yourself; it can never cover client-side route changes either way,
   * which is what {@link onDirtyChange} is for.
   *
   * @default true
   */
  unsavedChangesGuard?: boolean;

  onCreate?: (template: Template) => void;
  onLoad?: (template: Template) => void;
  onError?: (error: Error) => void;
  onComment?: (event: CommentEvent) => void;
  onUnmount?: () => void;

  onRequestMedia?: (context: MediaRequestContext) => Promise<MediaItem | null>;
  /**
   * Transform the rendered HTML just before Cloud sends a test email.
   *
   * Cloud-only, and deliberately so: it exists because *Cloud* renders the HTML,
   * so a consumer needs a seam into it. A consumer-supplied {@link testEmail}
   * provider *is* that seam, and this hook is not applied to it.
   */
  onBeforeTestEmail?: (html: string) => string | Promise<string>;

  /**
   * Sending backend for test emails.
   *
   * - **omitted** — sent by Templatical Cloud, gated on the `test_email` plan
   *   feature and its signed allowed-recipient list.
   * - **a {@link TestEmailProvider}** — sent by *you* instead, which is what to
   *   reach for when mail must leave your own infrastructure for compliance or
   *   data-residency reasons.
   *
   * The same type `init()` takes, so moving an OSS integration to Cloud means
   * deleting this key (to adopt Cloud's sender) or leaving it exactly as-is (to
   * keep your own) — never rewriting it.
   */
  testEmail?: TestEmailProvider;

  // There is deliberately no `render` key here, unlike `init()`. Cloud renders
  // server-side for test email, scheduled sends and API exports — its test-email
  // adapter calls `exportHtml` directly — so a consumer-supplied renderer would
  // have changed `toMjml()` / `toHtml()` and nothing else: what you previewed and
  // exported would not be what Cloud delivered. Cloud's output is also a
  // deliberate superset (a countdown resolves to a live server-generated GIF, a
  // video gets a composited play button), so the consumer's would be worse for
  // those blocks too. For your own MJML on Cloud, call
  // `renderToMjml(editor.getContent())` from `@templatical/renderer` directly.
  //
  // There is deliberately no `templates`, `versionHistory` or `comments` key here,
  // unlike `init()`. All three are keyed to the Cloud template id, which anchors
  // collaboration, AI rewrite, scoring, the server-side export — and version
  // history and comments themselves. A store Cloud never issued ids for would
  // degrade all of them silently, and a consumer-supplied history would run
  // alongside the automatic versions Cloud's templates adapter keeps recording:
  // two stores, one invisible and billable. `bootstrapCloud` warns and ignores if
  // any arrives from JavaScript. Bring your own with `init()`, where the whole set
  // is yours.
  //
  // Nor is there a `user` key. Cloud's comment writes are signed against the auth
  // token's `user` claim, so `initCloud()` fills `init({ user })` from there — a
  // consumer-supplied identity could only disagree with the one the backend
  // verifies. `commenting: false` is how you switch the feature off.

  /**
   * Resolves the template for preview surfaces — typically evaluating logic
   * tags (`{% if %}` … `{% endif %}`) against real data on your backend.
   *
   * The **same key and the same type as `init()`**, so adopting or dropping it
   * is a one-line change either way. Not plan-gated: this is a display concern,
   * and Cloud has no server-side resolver of its own to supersede it.
   *
   * Supersedes `MergeTag.sample` when configured, and the Sample/Label switch
   * stops rendering.
   */
  resolvePreview?: ResolvePreview;

  /**
   * Template linter (`@templatical/quality`) configuration. Runs every
   * linter exported by the package (accessibility + structure). Cloud
   * additionally merges `planConfig.accessibility` from the server (server
   * policy wins on conflict) — this option sets the consumer-supplied baseline.
   */
  lint?: import("@templatical/quality").LintOptions;
}
