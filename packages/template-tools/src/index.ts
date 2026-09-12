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

export {
  applyOperation,
  getColumnCount,
  type OperationResult,
} from "./operations";
