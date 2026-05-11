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
   * from the host page. When `false` (default), the editor mounts in light
   * DOM with current behavior — host stylesheets can still reach editor
   * elements via tag selectors (`p`, `a`, `input`, etc.).
   *
   * Phase 1 of the Shadow DOM migration ships this as opt-in. The default
   * will flip to `true` in a future minor; keep your integration on
   * `false` if you depend on light-DOM access to editor internals or need
   * Firefox <101 / Safari <16.4 support (`adoptedStyleSheets` requirement).
   *
   * @default false
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
