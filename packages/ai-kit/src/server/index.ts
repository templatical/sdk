// @templatical/ai-kit/server — the server kit (A1 §5). Isomorphic: Web Streams and
// fetch only. No HTML sanitizer here: the editor sanitizes everything it shows
// or applies.

export {
  buildChatRequest,
  buildAltTextRequest,
  buildEditingPrompt,
  buildFixRequest,
  buildRewritePrompt,
  editingInstructions,
  REWRITE_PRESET_INSTRUCTIONS,
  FIX_RULE_GUIDANCE,
  rewriteInstructions,
} from "./prompts";
export type { EditingPromptInput, RewritePromptInput } from "./prompts";
export {
  flattenMergeTags,
  mergeTagTokens,
  mergeTagTokensIn,
  unknownMergeTags,
} from "./merge-tags";
export { contentRuleRefusal, walkBlocks } from "./content-rules";
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
export type { AiWireRequest } from "./read-request";
export {
  buildAltTextRepairRequest,
  buildRewriteRepairPrompt,
  checkRewrite,
  checkAltText,
  checkAltTextAnswer,
} from "./checks";
