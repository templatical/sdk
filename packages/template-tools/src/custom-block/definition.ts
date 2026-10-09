// Structural validation of a custom block working file: the generated
// CustomBlockDefinition schema (dataSource excluded, see generate-schema.mjs),
// the hand-written dataSourcePreview recipe schema, and the field-model checks
// a JSON Schema can't express (duplicate keys, defaults within bounds).

import Ajv, { type ErrorObject } from "ajv";
import rawSchema from "../../custom-block-schema.json";
import type { CustomBlockCheckResult, CustomBlockIssue } from "./types";

const ajv = new Ajv({ allErrors: true, strict: false });
const validateDefinition = ajv.compile(rawSchema as object);

// Owned by this package: the recipe is a template-tools concept, not part of
// the SDK's block model, so it has no generated schema to drift from.
// Reports the first problem only: a recipe is small, and one pointed message
// reads better than a cascade of missing-property errors.
const validateRecipe = new Ajv({ allErrors: false, strict: false }).compile({
  type: "object",
  additionalProperties: false,
  required: ["label", "request", "map"],
  properties: {
    label: { type: "string", minLength: 1 },
    request: {
      type: "object",
      additionalProperties: false,
      required: ["url"],
      properties: {
        method: { enum: ["GET", "POST"] },
        url: { type: "string", minLength: 1 },
        headers: { type: "object", additionalProperties: { type: "string" } },
        body: { type: "string" },
      },
    },
    map: {
      type: "object",
      additionalProperties: { type: "string", minLength: 1 },
    },
  },
});

function schemaIssues(
  errors: ErrorObject[] | null | undefined,
  base = "",
): CustomBlockIssue[] {
  return (errors ?? []).map((e) => ({
    ruleId: "schema",
    severity: "error",
    path: `${base}${e.instancePath}` || "/",
    message: `${base}${e.instancePath || ""} ${e.message ?? "is invalid"}${
      e.keyword === "additionalProperties"
        ? ` (\`${(e.params as { additionalProperty: string }).additionalProperty}\`)`
        : ""
    }`.trim(),
  }));
}

interface FieldLike {
  key: string;
  type: string;
  default?: unknown;
  min?: number;
  max?: number;
  options?: { value: string }[];
  fields?: FieldLike[];
}

function fieldIssues(fields: FieldLike[], base: string): CustomBlockIssue[] {
  const issues: CustomBlockIssue[] = [];
  const seen = new Set<string>();
  fields.forEach((field, i) => {
    const path = `${base}/${i}`;
    if (seen.has(field.key)) {
      issues.push({
        ruleId: "field.duplicate-key",
        severity: "error",
        path,
        message: `Field key \`${field.key}\` is used twice; the second would overwrite the first's value.`,
      });
    }
    seen.add(field.key);
    if (field.type === "number" && typeof field.default === "number") {
      const below = field.min !== undefined && field.default < field.min;
      const above = field.max !== undefined && field.default > field.max;
      if (below || above) {
        issues.push({
          ruleId: "field.default-range",
          severity: "error",
          path: `${path}/default`,
          message: `\`${field.key}\` defaults to ${field.default}, outside ${field.min ?? "-∞"}–${field.max ?? "∞"}.`,
        });
      }
    }
    if (
      field.type === "select" &&
      field.default !== undefined &&
      !(field.options ?? []).some((o) => o.value === field.default)
    ) {
      issues.push({
        ruleId: "field.default-option",
        severity: "error",
        path: `${path}/default`,
        message: `\`${field.key}\` defaults to "${String(field.default)}", which is not one of its options.`,
      });
    }
    if (field.type === "repeatable" && field.fields) {
      issues.push(...fieldIssues(field.fields, `${path}/fields`));
    }
  });
  return issues;
}

export function validateCustomBlockDefinition(
  data: unknown,
): CustomBlockCheckResult {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return {
      valid: false,
      issues: [
        {
          ruleId: "schema",
          severity: "error",
          path: "/",
          message: "A custom block definition must be a JSON object.",
        },
      ],
    };
  }
  const { dataSourcePreview, ...definition } = data as Record<string, unknown>;
  const issues: CustomBlockIssue[] = [];
  if (!validateDefinition(definition)) {
    issues.push(...schemaIssues(validateDefinition.errors));
  }
  if (dataSourcePreview !== undefined && !validateRecipe(dataSourcePreview)) {
    issues.push(...schemaIssues(validateRecipe.errors, "/dataSourcePreview"));
  }
  if (issues.length === 0) {
    issues.push(
      ...fieldIssues((definition as { fields: FieldLike[] }).fields, "/fields"),
    );
  }
  return { valid: !issues.some((i) => i.severity === "error"), issues };
}
