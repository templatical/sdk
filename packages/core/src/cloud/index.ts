// Auth
export { AuthManager, createHeadlessAuthManager } from './auth';
export type { AuthConfig, AuthRequestOptions, HeadlessAuthConfig, TestEmailConfig, UserConfig } from './auth';

// API clients
export { ApiClient } from './api';
export { MediaApiClient } from './media-api';

// URL builder
export { API_ROUTES, buildUrl } from './url-builder';

// WebSocket
export { WebSocketClient, resolveWebSocketConfig } from './websocket-client';
export type { PresenceMember, WebSocketClientOptions, WebSocketConfig } from './websocket-client';

// MCP operation handler
export { handleOperation } from './mcp-operation-handler';

// Cloud editor
export { useEditor } from './editor';
export type { UseEditorOptions, UseEditorReturn } from './editor';

// AI
export { useAiChat } from './ai-chat';
export type { UseAiChatOptions, UseAiChatReturn } from './ai-chat';

export { useAiRewrite } from './ai-rewrite';
export type { UseAiRewriteOptions, UseAiRewriteReturn } from './ai-rewrite';

export { useAiConfig } from './ai-config';
export type { UseAiConfigReturn } from './ai-config';

export { useTemplateScoring } from './template-scoring';
export type { UseTemplateScoringOptions, UseTemplateScoringReturn } from './template-scoring';

export { useDesignReference } from './design-reference';
export type { DesignReferenceInput, UseDesignReferenceOptions, UseDesignReferenceReturn } from './design-reference';

// Comments
export { useComments } from './comments';
export type { UseCommentsOptions, UseCommentsReturn } from './comments';

export { useCommentListener } from './comment-listener';
export type { CommentBroadcastPayload, UseCommentListenerOptions } from './comment-listener';

// Collaboration
export { useCollaboration } from './collaboration';
export type { UseCollaborationOptions, UseCollaborationReturn } from './collaboration';

// WebSocket module
export { useWebSocket } from './web-socket';
export type { UseWebSocketOptions, UseWebSocketReturn } from './web-socket';

// Media
export { useMediaLibrary } from './media-library';
export type { MediaViewMode, UseMediaLibraryOptions } from './media-library';

// Saved modules
export { useSavedModules } from './saved-modules';
export type { UseSavedModulesOptions, UseSavedModulesReturn } from './saved-modules';

// Snapshots
export { useSnapshotHistory } from './snapshots';
export type { UseSnapshotHistoryOptions, UseSnapshotHistoryReturn } from './snapshots';

// Test email
export { useTestEmail } from './test-email';
export type { UseTestEmailOptions, UseTestEmailReturn } from './test-email';

// Export
export { useExport } from './export';
export type { UseExportOptions, UseExportReturn } from './export';

// Plan config
export { usePlanConfig } from './plan-config';
export type { UsePlanConfigOptions, UsePlanConfigReturn } from './plan-config';

// Health check
export { performHealthCheck } from './health-check';

// MCP listener
export { useMcpListener } from './mcp-listener';
export type { UseMcpListenerOptions } from './mcp-listener';
