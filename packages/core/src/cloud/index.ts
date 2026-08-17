// Auth
export { AuthManager, createSdkAuthManager, isFatalAuthError } from "./auth";
export type {
  AuthConfig,
  AuthRequestOptions,
  SdkAuthConfig,
  TestEmailConfig,
  UserConfig,
} from "./auth";

// API clients
export { ApiClient } from "./api";
// URL builder
export { API_ROUTES, buildUrl } from "./url-builder";

// WebSocket
export { WebSocketClient, resolveWebSocketConfig } from "./websocket-client";
export type {
  PresenceMember,
  WebSocketClientOptions,
  WebSocketConfig,
} from "./websocket-client";

// MCP operation handler
export { handleOperation } from "./mcp-operation-handler";

// AI
export { useAiChat } from "./ai-chat";
export type { UseAiChatOptions, UseAiChatReturn } from "./ai-chat";

export { useAiRewrite } from "./ai-rewrite";
export type { UseAiRewriteOptions, UseAiRewriteReturn } from "./ai-rewrite";

export { useAiConfig } from "./ai-config";
export type { UseAiConfigReturn } from "./ai-config";

export { useTemplateScoring } from "./template-scoring";
export type {
  UseTemplateScoringOptions,
  UseTemplateScoringReturn,
} from "./template-scoring";

export { useDesignReference } from "./design-reference";
export type {
  DesignReferenceInput,
  UseDesignReferenceOptions,
  UseDesignReferenceReturn,
} from "./design-reference";

// Comments — Cloud's adapter for the shared `CommentsProvider` contract, realtime
// included (its optional `subscribe` binds the presence channel). The reactive
// state is shared by both tiers from `@templatical/core`; the transport is the
// provider's business rather than a second composable's.
export { createCloudCommentsProvider } from "./comments-provider";
export type {
  CreateCloudCommentsProviderOptions,
  RealtimeChannel,
} from "./comments-provider";

// Collaboration
export { useCollaboration } from "./collaboration";
export { useCollaborationBroadcast } from "./collaboration-broadcast";
export type {
  UseCollaborationOptions,
  UseCollaborationReturn,
} from "./collaboration";

// WebSocket module
export { useWebSocket } from "./web-socket";
export type { UseWebSocketOptions, UseWebSocketReturn } from "./web-socket";

// Saved blocks — Cloud storage adapter for the shared `useSavedBlocks`
// composable in `@templatical/core`.
export { createCloudSavedBlocksProvider } from "./saved-blocks-provider";

// Templates — Cloud storage adapter for the save/load lifecycle. Passed as
// `useEditor({ templates })`, so Cloud persists over the same contract a BYO
// consumer implements.
export { createCloudTemplatesProvider } from "./templates-provider";

// Render — Cloud's server-side MJML/HTML renderer, behind the shared
// `RenderProvider` contract.
export { createCloudRenderProvider } from "./render-provider";
export type { CreateCloudRenderProviderOptions } from "./render-provider";

// Version history — Cloud's adapter for the shared `VersionHistoryProvider`
// contract. The reactive state is `useVersionHistory` in `@templatical/core`,
// shared by OSS and Cloud.
export { createCloudVersionHistoryProvider } from "./version-history-provider";

// Test email — the Cloud sending adapter for the shared `useTestEmailFeature`
// seam in `@templatical/editor`. `useTestEmail` remains for the config/state it
// still owns (plan enablement, the allowed-recipient list and its signature);
// the send body lives in the provider so both editors drive one code path.
export { useTestEmail } from "./test-email";
export type { UseTestEmailOptions, UseTestEmailReturn } from "./test-email";

export { createCloudTestEmailProvider } from "./test-email-provider";
export type { CreateCloudTestEmailProviderOptions } from "./test-email-provider";

// Export
export { useExport, resolveExportFonts } from "./export";
export type {
  ExportFontsPayload,
  UseExportOptions,
  UseExportReturn,
} from "./export";

// Plan config
export { usePlanConfig } from "./plan-config";
export type { UsePlanConfigOptions, UsePlanConfigReturn } from "./plan-config";

// Health check
export { performHealthCheck } from "./health-check";

// MCP listener
export { useMcpListener } from "./mcp-listener";
export type { UseMcpListenerOptions } from "./mcp-listener";
