export { lintAccessibility, ACCESSIBILITY_RULES } from "./accessibility";
export { lintStructure, STRUCTURE_RULES } from "./structure";
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
export {
  formatStructureMessage,
  getStructureMessages,
  SUPPORTED_STRUCTURE_MESSAGE_LOCALES,
} from "./structure/messages";
export type {
  StructureMessageMap,
  StructureRuleMessageId,
} from "./structure/messages";
export type {
  LintIssue,
  LintOptions,
  LintPatch,
  LintPatchContext,
  LintThresholds,
  ResolvedOptions,
  Rule,
  RuleHit,
  RuleMeta,
  Severity,
  WalkContext,
} from "./types";
export { DEFAULT_A11Y_THRESHOLDS } from "./types";
