// @templatical/ai/server — the server kit (A1 §5). Isomorphic: Web Streams and
// fetch only. No HTML sanitizer here: the editor sanitizes everything it shows
// or applies.

export {
  buildChatRequest,
  buildDesignRequest,
  buildEditingPrompt,
  buildFixRequest,
  buildRewritePrompt,
  buildScorePrompt,
  buildSuggestionsPrompt,
  designInstructions,
  editingInstructions,
  REWRITE_PRESET_INSTRUCTIONS,
  rewriteInstructions,
  scoreInstructions,
  suggestionsInstructions,
} from "./prompts";
export type { EditingPromptInput, RewritePromptInput } from "./prompts";
export {
  flattenMergeTags,
  mergeTagTokens,
  mergeTagTokensIn,
  unknownMergeTags,
} from "./merge-tags";
export { blockIds, contentRuleRefusal, walkBlocks } from "./content-rules";
export { describeOp, opRefusal } from "./refusal";
export type { NamedLock } from "./refusal";
export { applyOperationsTool } from "./tool";
export type { AiToolDefinition } from "./tool";
export {
  createEditingSession,
  EDITING_SESSION_LIMITS,
} from "./editing-session";
export type {
  EditingApplyResult,
  EditingSession,
  EditingSessionLimits,
  EditingSessionOptions,
} from "./editing-session";
export { SdkError, ThrottledError } from "@templatical/types";

export type {
  AiModelAdapter,
  AiModelAttachment,
  AiModelMessage,
  AiModelPart,
  AiModelToolCall,
  AiUsage,
} from "./model";
export { runEditingTurn } from "./run-editing-turn";
export type {
  EditingTurnRequest,
  EditingTurnResult,
  RunEditingTurnOptions,
} from "./run-editing-turn";
export { aiEventStream } from "./event-stream";
export type {
  AiEventStreamController,
  AiEventStreamOptions,
} from "./event-stream";
export { aiErrorEvent, aiErrorResponse, aiJsonResponse } from "./errors";
export { readAiRequest } from "./read-request";
export type { AiDesignBody, AiWireRequest } from "./read-request";
export {
  buildRewriteRepairPrompt,
  checkRewrite,
  normalizeScoringResult,
  parseSuggestions,
  scoringResultSchema,
  suggestionsSchema,
} from "./checks";
