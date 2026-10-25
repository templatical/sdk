// @templatical/ai-kit/testing — verification shipped with the package (A1 §6).
export { runAiProviderConformance } from "./conformance";
export type {
  AiConformanceCheck,
  AiConformanceOptions,
  AiConformanceReport,
} from "./conformance";
export { runAiWireConformance } from "./wire-conformance";
export type { AiWireConformanceOptions } from "./wire-conformance";
export { createMockAiProvider } from "./mock-provider";
export type {
  AiMockScript,
  AiRecordedEvent,
  AiRecordedTurn,
  AiRecording,
} from "./mock-provider";
export { AI_RECORDINGS } from "./recordings";
export {
  AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
  AI_EVAL_CASES,
  AI_EVAL_MERGE_TAGS,
  AI_EVAL_TEMPLATES,
  checkEvalCase,
  evalTurnWith,
  evalAltTextWith,
  runAiEvalSet,
} from "./eval-set";
export type {
  AiEvalCase,
  AiEvalAltCheck,
  AiEvalAltTextInput,
  AiEvalCheck,
  AiEvalReport,
  AiEvalTurnInput,
  AiEvalTurnOutput,
} from "./eval-set";
export { createStandInEditor } from "./stand-in-editor";
export type { StandInEditor } from "./stand-in-editor";
