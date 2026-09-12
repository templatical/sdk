// Structural validation of a Templatical template against the generated JSON
// Schema, plus the @templatical/quality lint layered on top.
//
// Structural validation is discriminator-aware: each block is checked against
// the subschema for its declared `type` (e.g. a block with `"type": "button"`
// is validated as a ButtonBlock), so errors are precise ("blocks[2] (button)
// must have required property 'url'") instead of the raw anyOf's "must match
// exactly one schema in anyOf".

import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import { lintTemplate, type LintIssue } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";
import rawSchema from "../schema.json";

interface SchemaDefinition {
  properties?: { type?: { const?: unknown } } & Record<string, unknown>;
  [key: string]: unknown;
}

interface SchemaDocument {
  definitions: Record<string, SchemaDefinition>;
  [key: string]: unknown;
}

/** The generated JSON Schema for `TemplateContent`, as a plain object. */
export const schema = rawSchema as unknown as SchemaDocument;

const ajv = new Ajv({ allErrors: true, strict: false });

// Map a block's `type` discriminator (e.g. "button", "social") to its schema
// definition name (e.g. "ButtonBlock", "SocialIconsBlock"), derived from the
// schema itself so it never drifts from the generated defs.
const typeToDef: Record<string, string> = {};
for (const [name, def] of Object.entries(schema.definitions)) {
  const constType = def?.properties?.type?.const;
  if (typeof constType === "string") {
    typeToDef[constType] = name;
  }
}

const validatorCache = new Map<string, ValidateFunction>();

function validatorFor(defName: string): ValidateFunction {
  const cached = validatorCache.get(defName);
  if (cached) return cached;

  const definitions = structuredClone(schema.definitions);
  // A section's `children` holds nested blocks (Block[][]); we recurse into
  // them separately for precise paths, so stub the deep check here.
  if (defName === "SectionBlock") {
    const section = definitions.SectionBlock;
    if (section?.properties) {
      section.properties.children = { type: "array" };
    }
  }
  const compiled = ajv.compile({
    $ref: `#/definitions/${defName}`,
    definitions,
  });
  validatorCache.set(defName, compiled);
  return compiled;
}

const settingsValidator = ajv.compile({
  $ref: "#/definitions/TemplateSettings",
  definitions: structuredClone(schema.definitions),
});

interface FlatBlock {
  path: string;
  block: Record<string, unknown> | null;
}

function flattenBlocks(
  blocks: unknown,
  basePath: string,
  out: FlatBlock[],
): void {
  if (!Array.isArray(blocks)) return;
  blocks.forEach((block, i) => {
    const path = `${basePath}[${i}]`;
    out.push({ path, block: block ?? null });
    if (block?.type === "section" && Array.isArray(block.children)) {
      block.children.forEach((column: unknown, ci: number) => {
        flattenBlocks(column, `${path}.children[${ci}]`, out);
      });
    }
  });
}

function formatAjvErrors(
  errors: ErrorObject[] | null | undefined,
  prefix: string,
): string[] {
  return (errors ?? []).map((e) => {
    const where = `${prefix}${e.instancePath}`;
    const extra =
      e.keyword === "additionalProperties"
        ? ` (${(e.params as { additionalProperty?: string }).additionalProperty})`
        : "";
    return `${where} ${e.message}${extra}`;
  });
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Structural validation. Synchronous, depends only on ajv + the committed
 * schema.json (no build of the workspace packages required).
 */
export function validateTemplate(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["(root) must be an object"] };
  }

  const doc = data as Record<string, unknown>;

  if (!Array.isArray(doc.blocks)) {
    errors.push("blocks must be an array");
  }
  if (doc.settings === null || typeof doc.settings !== "object") {
    errors.push("settings must be an object");
  } else if (!settingsValidator(doc.settings)) {
    errors.push(...formatAjvErrors(settingsValidator.errors, "settings"));
  }

  const flat: FlatBlock[] = [];
  flattenBlocks(doc.blocks, "blocks", flat);
  for (const { path, block } of flat) {
    const type = block?.type;
    const defName = typeof type === "string" ? typeToDef[type] : undefined;
    if (!defName) {
      const known = Object.keys(typeToDef).join(", ");
      errors.push(
        `${path} has unknown or missing block type ${JSON.stringify(type)} (expected one of: ${known})`,
      );
      continue;
    }
    const validate = validatorFor(defName);
    if (!validate(block)) {
      errors.push(...formatAjvErrors(validate.errors, `${path} (${type})`));
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface QualityLintResult {
  issues: LintIssue[];
  /** Set when the linter itself threw — the template is structurally suspect. */
  error?: string;
}

/**
 * Quality layer — accessibility / structure / link linting.
 *
 * Assumes structurally-valid input, so callers should run `validateTemplate`
 * first; the try/catch is a guard against a malformed template crashing the
 * linter rather than a substitute for that ordering.
 */
export function runQualityLint(data: unknown): QualityLintResult {
  try {
    return { issues: lintTemplate(data as TemplateContent) ?? [] };
  } catch (err) {
    return { issues: [], error: (err as Error).message };
  }
}
