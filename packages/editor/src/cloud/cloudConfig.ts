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
}
