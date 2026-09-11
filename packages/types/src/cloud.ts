import type { CommentAuthor } from "./comments";
import type {
  SyntaxPreset,
  SyntaxPresetName,
  Template,
  TemplateContent,
  ViewportSize,
} from "./index";

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
 * Cloud's HTTP row for one version — what the API returns, not the BYO
 * {@link TemplateVersion} contract. `createCloudVersionHistoryProvider`
 * copies the fields the contract uses (`id`, `createdAt`, `isAutomatic`,
 * `content`) and drops `templateId`.
 */
export interface TemplateVersionResponse {
  id: string;
  templateId?: string;
  content: TemplateContent;
  isAutomatic: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Cloud's HTTP row for one comment — what the API returns, not the BYO
 * {@link Comment} contract. Same field names as `Comment`, plus optional
 * `templateId`. `createCloudCommentsProvider` omits `updatedAt` when it
 * equals `createdAt` (Cloud stamps both on insert) so the panel does not
 * mark every comment "(edited)".
 */
export interface CommentResponse {
  id: string;
  templateId?: string;
  blockId: string | null;
  parentId: string | null;
  body: string;
  author: CommentAuthor;
  resolvedAt: string | null;
  resolvedBy: CommentAuthor | null;
  createdAt: string;
  updatedAt: string;
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
  expiresAt: number;
  projectId: string;
  tenant: string;
  testEmail?: {
    allowedEmails: string[];
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
// Template operations
// ---------------------------------------------------------------------------

// The operation vocabulary shared by the CLI's `edit` command, Cloud's MCP
// bridge and the collaboration broadcast. Named for what it operates on rather
// than for any one transport — the same seven operations travel over stdio,
// over Pusher and over a local file edit. The names are camelCase to match the
// payload keys beside them (`blockId`, `targetSectionId`) and every other
// identifier in this package.
export type TemplateOperation =
  | "addBlock"
  | "updateBlock"
  | "deleteBlock"
  | "moveBlock"
  | "updateSettings"
  | "setContent"
  | "updateBlockStyle";

export interface TemplateOperationPayload {
  operation: TemplateOperation;
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
  onOperation?: (payload: TemplateOperationPayload) => void;
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
  appKey: string;
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
  aiGeneration: boolean;
  /** Realtime connection capacity. */
  collaboration: boolean;
  /** Storage plus realtime fan-out. */
  commenting: boolean;
  /** Storage for saved blocks. */
  savedModules: boolean;
  /** Sending cost and deliverability reputation. */
  testEmail: boolean;
}

export interface PlanLimits {
  maxFileSizeMb: number;
  maxTemplates: number | null;
  mediaCategories: string[];
  storageLimitBytes: number;
}

/**
 * Cloud JWT/plan wire shape for one media category — what the plan payload
 * carries, not a BYO contract field.
 */
export interface MediaCategoryData {
  mimeTypes: string[];
  extensions: string[];
}

/**
 * Cloud JWT/plan wire shape for media entitlements — what the plan payload
 * carries, not the BYO {@link MediaProvider} contract.
 */
export interface MediaConfig {
  useMediaLibrary: boolean;
  categories: Record<string, MediaCategoryData>;
  maxFileSize: number;
}

/**
 * Cloud JWT/plan wire shape for storage quota — what the plan payload
 * carries. Same fields as {@link MediaStorageInfo}.
 */
export interface StorageInfo {
  usedBytes: number;
  limitBytes: number;
}

export interface PlanConfig {
  features: PlanFeatures;
  limits: PlanLimits;
  templateCount: number;
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
