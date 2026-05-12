import type {
  AiConfig,
  BlockDefaults,
  CollaborationConfig,
  CommentEvent,
  CustomBlockDefinition,
  DisplayConditionsConfig,
  FontsConfig,
  McpConfig,
  MergeTagsConfig,
  SaveResult,
  Template,
  TemplateContent,
  TemplateDefaults,
  ThemeOverrides,
  UiTheme,
} from "@templatical/types";
import type {
  MediaItem,
  MediaRequestContext,
} from "@templatical/media-library";

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

  ai?: AiConfig | false;
  commenting?: boolean;
  collaboration?: CollaborationConfig;
  mcp?: McpConfig;
  blockDefaults?: BlockDefaults;
  templateDefaults?: TemplateDefaults;

  modules?: boolean;
  autoSave?: boolean;
  autoSaveDebounce?: number;

  mergeTags?: MergeTagsConfig;
  displayConditions?: DisplayConditionsConfig;
  customBlocks?: CustomBlockDefinition[];
  fonts?: FontsConfig;
  onChange?: (content: TemplateContent) => void;
  onSave?: (result: SaveResult) => void;
  onCreate?: (template: Template) => void;
  onLoad?: (template: Template) => void;
  onError?: (error: Error) => void;
  onComment?: (event: CommentEvent) => void;
  onUnmount?: () => void;

  onRequestMedia?: (context: MediaRequestContext) => Promise<MediaItem | null>;
  onBeforeTestEmail?: (html: string) => string | Promise<string>;

  /**
   * Accessibility linter (`@templatical/quality`) configuration. Cloud
   * additionally merges `planConfig.accessibility` from the server (server
   * policy wins on conflict) — this option sets the consumer-supplied baseline.
   */
  accessibility?: import("@templatical/quality").A11yOptions;
}
