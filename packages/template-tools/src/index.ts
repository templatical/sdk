// Shared Templatical template tooling.
//
// This entry is the platform-neutral half: the generated JSON Schema, structural
// validation, and the quality lint. The local live-preview bridge lives behind
// the ./live subpath because it is Node-only (node:http, node:fs).

export {
  schema,
  validateTemplate,
  runQualityLint,
  type ValidationResult,
  type QualityLintResult,
} from "./validate";

// The operation engine lives in @templatical/types, shared with the editor,
// collaboration backends and Templatical Cloud; `edit` runs it.
export {
  applyOperations,
  getColumnCount,
  OperationError,
} from "@templatical/types";
export {
  checkCustomBlock,
  validateCustomBlockDefinition,
  SPECIMEN_STATES,
  type CheckCustomBlockOptions,
  type CustomBlockCheckResult,
  type CustomBlockIssue,
  type CustomBlockIssueSeverity,
  type CustomBlockWorkingFile,
  type DataSourcePreview,
  type SpecimenState,
} from "./custom-block";
