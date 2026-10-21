// @templatical/ai — bring your own AI backend to the Templatical editor (A1).
//
// This entry is the wire: routes, headers, events, bodies, error statuses and
// limits, plus the contract types from @templatical/types. The client is
// ./client, the server kit ./server, the test kit ./testing; prompts, schemas
// and the test set are files under ./prompts, ./schema and ./eval.

export * from "./wire";

export type {
  AiAppliedBatch,
  AiChatMessage,
  AiChatRequest,
  AiConversationProvider,
  AiDesignRequest,
  AiErrorCode,
  AiFeatureName,
  AiFixFinding,
  AiFixRequest,
  AiLimitDetails,
  AiLintFinding,
  AiMergeTag,
  AiMergeTags,
  AiMergeTagSyntax,
  AiMessageBatch,
  AiMessageKind,
  AiOperationsResult,
  AiProvider,
  AiReplay,
  AiReplayContext,
  AiReplayOutcome,
  AiRequestBase,
  AiRewriteHandlers,
  AiRewritePreset,
  AiRewriteRequest,
  AiScoreRequest,
  AiSuggestionsRequest,
  AiTurnHandlers,
  AiTurnResult,
  CategoryScore,
  FindingSeverity,
  Operation,
  ScoringCategory,
  ScoringFinding,
  ScoringResult,
  TemplateContent,
} from "@templatical/types";
export {
  CollaborationConflict,
  SdkError,
  ThrottledError,
} from "@templatical/types";
