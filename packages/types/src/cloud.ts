import type {
  SyntaxPreset,
  SyntaxPresetName,
  Template,
  TemplateContent,
  ViewportSize,
} from "./index";

// Still a type-only import, so the media-library devDependency (and the
// media-library-before-types build order) stays load-bearing for `PlanConfig`.
import type { MediaConfig, StorageInfo } from "@templatical/media-library";

// Re-export OSS types used by Cloud consumers
export type { SyntaxPreset, SyntaxPresetName, ViewportSize };

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

// `Template` describes a stored template rather than a Cloud concept, so the
// contract lives in `./templates` next to `TemplatesProvider`. Re-exported here
// so cloud modules can import it from either path.
export type { Template };

/**
 * Cloud's wire shape for one version — snake_case, i.e. what the API returns,
 * not a contract shape. `createCloudVersionHistoryProvider` maps it to the
 * camelCase `TemplateVersion` a consumer's provider also returns.
 */
export interface TemplateVersionResponse {
  id: string;
  template_id: string;
  content: TemplateContent;
  is_autosave: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Cloud's wire shape for one comment — snake_case, i.e. what the API returns,
 * not a contract shape. `createCloudCommentsProvider` maps it to the camelCase
 * `Comment` a consumer's provider also returns.
 *
 * Same split as `TemplateVersionResponse` → `TemplateVersion`, and for the same
 * reason: a wire format is one backend's business, and putting it in the contract
 * would make every BYO implementer speak Cloud's dialect.
 */
export interface CommentResponse {
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
  replies: CommentResponse[];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type FindingSeverity = "high" | "medium" | "low";

export type ScoringCategory =
  "spam" | "readability" | "accessibility" | "bestPractices";

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

/**
 * Cloud's entitlement flags — the one thing in the SDK that is deliberately
 * **not** an interface a consumer could implement. Everything else is a
 * provider; this is Cloud's commercial layer sitting above the provider set,
 * which is exactly where the OSS/commercial line is drawn.
 *
 * **A flag is legitimate only when it meters a resource Cloud itself buys.**
 * Four kinds of gate do not belong here, however tempting:
 *
 * - Editor *capability* the OSS build grants free — fonts, theming, custom
 *   blocks, autosave. Gating it leaves a paying customer worse off than a free
 *   one.
 * - Declining to use a Cloud service — a consumer's own media storage, for
 *   instance. Charging for the *absence* of a Cloud cost is backwards, which is
 *   why the media tier is limits-only.
 * - Anything a browser flag cannot enforce: HTML output belongs to the server
 *   render, MJML export is unenforceable because `@templatical/renderer` is MIT
 *   (whoever holds the JSON holds the MJML), and headless access is a
 *   server-side auth question.
 * - Anything config already decides — `branding: false` hides the footer on any
 *   plan without an entitlement's help.
 *
 * Quantity limits are the honest lever — see {@link PlanLimits}.
 */
export interface PlanFeatures {
  /** Inference spend, per call. */
  ai_generation: boolean;
  /** Realtime connection capacity. */
  collaboration: boolean;
  /** Storage plus realtime fan-out. */
  commenting: boolean;
  /** Storage for saved blocks. */
  saved_modules: boolean;
  /** Sending cost and deliverability reputation. */
  test_email: boolean;
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
  accessibility?: {
    blockOnError?: boolean;
  };
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
