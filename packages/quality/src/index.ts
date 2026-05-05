export { lintAccessibility, RULES } from "./accessibility";
export { walkBlocks } from "./walk";
export type { Visitor } from "./walk";
export { getContrastRatio, parseHex, isOpaqueHex } from "./contrast";
export { extractAnchors, extractText } from "./html-utils";
export type { AnchorInfo } from "./html-utils";
export {
  getDictionary,
  SUPPORTED_DICTIONARY_LOCALES,
} from "./accessibility/dictionaries";
export type { Dictionary } from "./accessibility/dictionaries";
export {
  formatMessage,
  getMessages,
  SUPPORTED_MESSAGE_LOCALES,
} from "./accessibility/messages";
export type { MessageMap, RuleMessageId } from "./accessibility/messages";
export type {
  A11yIssue,
  A11yOptions,
  A11yPatch,
  A11yPatchContext,
  A11yThresholds,
  ResolvedOptions,
  Rule,
  RuleHit,
  RuleMeta,
  Severity,
  WalkContext,
} from "./types";
export { DEFAULT_THRESHOLDS } from "./types";
