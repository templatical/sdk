// Structural validation of a Templatical template against the generated JSON
// Schema, plus the @templatical/quality lint layered on top.
//
// Structural validation is discriminator-aware: each block is checked against
// the subschema for its declared `type` (e.g. a block with `"type": "button"`
// is validated as a ButtonBlock), so errors are precise ("blocks[2] (button)
// must have required property 'url'") instead of the raw anyOf's "must match
// exactly one schema in anyOf".

import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import {
  lintTemplate,
  type LintIssue,
  type LintOptions,
} from "@templatical/quality";
import {
  defaultLocaleOf,
  isSafePath,
  isLocaleTag,
  readPath,
  SETTINGS_TRANSLATABLE_FIELDS,
  translatableFields,
  SdkError,
  type Block,
  type BlockLocaleLayer,
  type CustomBlockDefinition,
  type SettingsLocaleLayer,
  type TemplateContent,
} from "@templatical/types";
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

function pathNeedsDottedElementId(target: unknown, path: string): boolean {
  const segments = path.split(".");
  let current = target;
  for (let i = 0; i < segments.length; i++) {
    if (Array.isArray(current)) {
      const remaining = segments.slice(i).join(".");
      if (
        current.some(
          (item) =>
            typeof item?.id === "string" &&
            item.id.includes(".") &&
            (remaining === item.id || remaining.startsWith(`${item.id}.`)),
        )
      )
        return true;
    }
    current = readPath(current, segments[i]);
  }
  return false;
}

function validateLocalization(
  content: TemplateContent,
  flat: FlatBlock[],
  definitions: readonly CustomBlockDefinition[],
): string[] {
  const { settings } = content;
  if (
    settings.locales === undefined &&
    settings.l10n === undefined &&
    !flat.some(({ block }) => block?.l10n !== undefined)
  )
    return [];

  const errors: string[] = [];
  const checkedTag = (tag: string, where: string): string | undefined => {
    if (isLocaleTag(tag)) return tag.toLowerCase();
    errors.push(
      `${where} must be a valid LOC1 locale tag (2–3 letter language, then 2–8 character subtags)`,
    );
    return undefined;
  };
  const fallback = checkedTag(defaultLocaleOf(content), "settings.locale");
  const locales = settings.locales ?? [];
  if (settings.locales?.length === 0) {
    errors.push("settings.locales must be omitted when empty");
  }
  const seen = new Set<string>();
  locales.forEach((tag, i) => {
    const normalized = checkedTag(tag, `settings.locales[${i}]`);
    if (normalized === undefined) return;
    if (normalized === fallback) {
      errors.push(`settings.locales[${i}] must not contain the default locale`);
    }
    if (seen.has(normalized)) {
      errors.push(`settings.locales[${i}] is a duplicate locale`);
    }
    seen.add(normalized);
  });

  const checkLayers = (
    target: unknown,
    layers: Record<string, BlockLocaleLayer | SettingsLocaleLayer> | undefined,
    where: string,
    textPaths: readonly string[],
    immutable: readonly string[],
  ) => {
    if (layers === undefined) return;
    if (Object.keys(layers).length === 0) {
      errors.push(`${where}.l10n must be omitted when empty`);
    }
    for (const [locale, layer] of Object.entries(layers)) {
      const prefix = `${where}.l10n[${JSON.stringify(locale)}]`;
      checkedTag(locale, prefix);
      if (!locales.includes(locale)) {
        errors.push(`${prefix} must be declared in settings.locales`);
      }
      if (Object.keys(layer).length === 0) {
        errors.push(`${prefix} must be omitted when empty`);
      }
      for (const kind of ["text", "set"] as const) {
        const entries = layer[kind];
        if (entries === undefined) continue;
        if (Object.keys(entries).length === 0) {
          errors.push(`${prefix}.${kind} must be omitted when empty`);
        }
        for (const path of Object.keys(entries)) {
          const field = `${prefix}.${kind}[${JSON.stringify(path)}]`;
          if (!isSafePath(path)) {
            errors.push(`${field} is an unsafe path`);
            continue;
          }
          if (readPath(target, path) === undefined) {
            if (pathNeedsDottedElementId(target, path)) {
              errors.push(
                `${field}: element ids containing '.' can't be localized`,
              );
              continue;
            }
            const segments = path.split(".");
            const parent =
              segments.length === 1
                ? target
                : readPath(target, segments.slice(0, -1).join("."));
            if (
              kind === "text" ||
              parent === null ||
              typeof parent !== "object" ||
              Array.isArray(parent)
            ) {
              errors.push(`${field} does not resolve in its base`);
            }
          }
          if (immutable.includes(path.split(".")[0])) {
            errors.push(`${field} cannot override ${path.split(".")[0]}`);
          }
          if (kind === "text" && !textPaths.includes(path)) {
            errors.push(`${field} is not translatable`);
          }
          if (kind === "text" && layer.set && Object.hasOwn(layer.set, path)) {
            errors.push(`${field} must not appear in both text and set`);
          }
        }
      }
    }
  };

  for (const { path, block } of flat) {
    const typed = block as unknown as Block;
    checkLayers(
      typed,
      typed.l10n,
      path,
      translatableFields(typed, definitions),
      ["id", "type", "children", "l10n"],
    );
  }
  checkLayers(
    settings,
    settings.l10n,
    "settings",
    SETTINGS_TRANSLATABLE_FIELDS,
    ["locale", "locales", "l10n"],
  );
  return errors;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Structural validation. Synchronous, depends only on ajv + the committed
 * schema.json, followed by localization semantics. Custom text paths require
 * the matching definitions; without them, custom blocks have no text paths.
 */
export function validateTemplate(
  data: unknown,
  definitions: readonly CustomBlockDefinition[] = [],
): ValidationResult {
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

  if (errors.length === 0) {
    errors.push(
      ...validateLocalization(data as TemplateContent, flat, definitions),
    );
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
export function runQualityLint(
  data: unknown,
  options: LintOptions = {},
): QualityLintResult {
  try {
    return { issues: lintTemplate(data as TemplateContent, options) ?? [] };
  } catch (err) {
    if (err instanceof SdkError && err.code === "unknown_locale") throw err;
    return { issues: [], error: (err as Error).message };
  }
}
