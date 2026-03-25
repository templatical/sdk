import type {
  Block,
  CustomBlockDefinition,
  DisplayConditionsConfig,
  FontsConfig,
  MergeTag,
  MergeTagsConfig,
  SyntaxPreset,
  SyntaxPresetName,
  TemplateContent,
  ThemeOverrides,
  ViewportSize,
} from "./index";

import type {
  MediaConfig,
  MediaItem,
  MediaRequestContext,
  StorageInfo,
} from "@templatical/media-library";

// Re-export OSS types used by Cloud consumers
export type { SyntaxPreset, SyntaxPresetName, ViewportSize };

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface Template {
  id: string;
  content: TemplateContent;
}

export interface TemplateSnapshot {
  id: string;
  template_id: string;
  content: TemplateContent;
  is_autosave: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface Comment {
  id: string;
  template_id: string;
  block_id: string | null;
  parent_id: string | null;
  body: string;
  author_identifier: string;
  author_name: string;
  resolved_at: string | null;
  resolved_by_identifier: string | null;
  resolved_by_name: string | null;
  created_at: string;
  updated_at: string;
  replies: Comment[];
}

export type CommentThread = Comment;

export type CommentEventType =
  | "created"
  | "updated"
  | "deleted"
  | "resolved"
  | "unresolved";

export interface CommentEvent {
  type: CommentEventType;
  comment: Comment;
}

// ---------------------------------------------------------------------------
// Saved Modules
// ---------------------------------------------------------------------------

export interface SavedModule {
  id: string;
  name: string;
  content: Block[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type FindingSeverity = "high" | "medium" | "low";

export type ScoringCategory =
  | "spam"
  | "readability"
  | "accessibility"
  | "bestPractices";

export interface ScoringFinding {
  id: string;
  severity: FindingSeverity;
  message: string;
  blockId: string | null;
  category: ScoringCategory;
  suggestion: string;
}

export interface CategoryScore {
  score: number;
  findings: ScoringFinding[];
}

export interface ScoringResult {
  score: number;
  categories: Record<ScoringCategory, CategoryScore>;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  api: { ok: boolean; latency: number };
  websocket: { ok: boolean; error?: string };
  auth: { ok: boolean; error?: string };
  overall: boolean;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface TokenData {
  token: string;
  expires_at: number;
  project_id: string;
  tenant: string;
  test_email?: {
    allowed_emails: string[];
    signature: string;
  };
  user?: {
    id: string;
    name: string;
    signature: string;
  };
}

export interface AuthRequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  credentials?: RequestCredentials;
}

export interface AuthConfig {
  url: string;
  baseUrl?: string;
  requestOptions?: AuthRequestOptions;
  onError?: (error: Error) => void;
}

export interface TestEmailConfig {
  allowedEmails: string[];
  signature: string;
}

export interface UserConfig {
  id: string;
  name: string;
  signature: string;
}

export interface DirectAuthConfig {
  mode: "direct";
  clientId: string;
  clientSecret: string;
  tenant: string;
  baseUrl?: string;
}

export interface ProxyAuthConfig {
  mode: "proxy";
  url: string;
  baseUrl?: string;
  requestOptions?: AuthRequestOptions;
}

export type SdkAuthConfig = DirectAuthConfig | ProxyAuthConfig;

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  selectedBlockId: string | null;
}

// ---------------------------------------------------------------------------
// MCP Operations
// ---------------------------------------------------------------------------

export type McpOperation =
  | "add_block"
  | "update_block"
  | "delete_block"
  | "move_block"
  | "update_settings"
  | "set_content"
  | "update_block_style";

export interface McpOperationPayload {
  operation: McpOperation;
  data: Record<string, unknown>;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// SDK Configuration
// ---------------------------------------------------------------------------

export interface SaveResult {
  templateId: string;
  html: string;
  mjml: string;
  content: TemplateContent;
}

export interface AiConfig {
  chat?: boolean;
  scoring?: boolean;
  designToTemplate?: boolean;
  rewrite?: boolean;
}

export interface McpConfig {
  enabled: boolean;
  onOperation?: (payload: McpOperationPayload) => void;
}

export interface CollaborationConfig {
  enabled: boolean;
  onCollaboratorJoined?: (collaborator: Collaborator) => void;
  onCollaboratorLeft?: (collaborator: Collaborator) => void;
  onBlockLocked?: (event: {
    blockId: string;
    collaborator: Collaborator;
  }) => void;
  onBlockUnlocked?: (event: {
    blockId: string;
    collaborator: Collaborator;
  }) => void;
}

export interface WebSocketServerConfig {
  host: string;
  port: number;
  app_key: string;
}

export interface TemplaticalConfig {
  container: string | HTMLElement;
  auth: Omit<AuthConfig, "onError">;
  baseUrl?: string;
  theme?: ThemeOverrides;
  locale?: string;
  ai?: AiConfig | false;
  onCreate?: (template: Template) => void;
  onLoad?: (template: Template) => void;
  onSave?: (result: SaveResult) => void;
  onError?: (error: Error) => void;
  onUnmount?: () => void;
  mergeTags?: MergeTagsConfig;
  onRequestMergeTag?: () => Promise<MergeTag | null>;
  onRequestMedia?: (context: MediaRequestContext) => Promise<MediaItem | null>;
  displayConditions?: DisplayConditionsConfig;
  fonts?: FontsConfig;
  autoSave?: boolean;
  autoSaveDebounce?: number;
  onBeforeTestEmail?: (html: string) => string | Promise<string>;
  customBlocks?: CustomBlockDefinition[];
  commenting?: boolean;
  onComment?: (event: CommentEvent) => void;
  mcp?: McpConfig;
  collaboration?: CollaborationConfig;
  modules?: boolean;
}

export interface TemplaticalInstance {
  setTheme(theme: ThemeOverrides): void;
  create(content?: TemplateContent): Promise<Template>;
  load(templateId: string): Promise<Template>;
  save(): Promise<SaveResult>;
  unmount(): void;
}

export interface EditorState {
  template: Template | null;
  content: TemplateContent;
  selectedBlockId: string | null;
  viewport: ViewportSize;
  darkMode: boolean;
  previewMode: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Plan Configuration
// ---------------------------------------------------------------------------

export interface PlanFeatures {
  media_folders: boolean;
  import_from_url: boolean;
  auto_save: boolean;
  custom_fonts: boolean;
  theme_customization: boolean;
  html_block: boolean;
  export_mjml: boolean;
  white_label: boolean;
  test_email: boolean;
  ai_generation: boolean;
  custom_blocks: boolean;
  commenting: boolean;
  collaboration: boolean;
  saved_modules: boolean;
  headless_sdk: boolean;
  pluggable_media: boolean;
}

export interface PlanLimits {
  max_file_size_mb: number;
  max_templates: number | null;
  media_categories: string[];
  storage_limit_bytes: number;
}

export interface PlanConfig {
  features: PlanFeatures;
  limits: PlanLimits;
  template_count: number;
  plan: string;
  media: MediaConfig;
  storage: StorageInfo;
  websocket: WebSocketServerConfig;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Cloud API Data Types
// ---------------------------------------------------------------------------

export interface CreateCommentData {
  body: string;
  blockId?: string;
  parentId?: string;
  authorIdentifier: string;
  authorName: string;
}

export interface UpdateCommentData {
  body: string;
}

export interface AiGenerateOptions {
  conversationId?: string;
}

export interface AiStreamEvent {
  type: "text" | "done" | "error";
  text?: string;
  content?: TemplateContent;
  conversationId?: string;
  error?: string;
}

export interface RewriteData {
  text: string;
  instruction: string;
  blockId: string;
}

export interface AiScoreOptions {
  fixFindingId?: string;
}
