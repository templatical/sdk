// Validates a Templatical template JSON document against the generated JSON
// Schema (reference/schema.json) and, when @templatical/quality is available,
// layers accessibility/structure/link linting on top.
//
// Structural validation is discriminator-aware: each block is checked against
// the subschema for its declared `type` (e.g. a block with `"type": "button"`
// is validated as a ButtonBlock), so errors are precise ("blocks[2] (button)
// must have required property 'url'") instead of the raw anyOf's "must match
// exactly one schema in anyOf".
//
// Usage (after `npm i ajv` in this folder, `@templatical/quality` optional):
//   node scripts/validate.mjs path/to/template.json
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// `ajv` is the skill's one required dependency. Load it dynamically so a fresh
// install (where it isn't installed yet) gets an actionable message instead of a
// raw "Cannot find package 'ajv'" stack trace.
let Ajv;
try {
  ({ default: Ajv } = await import("ajv"));
} catch {
  console.error(
    "This skill's validator needs its dependency `ajv`, which isn't installed.\n" +
      "Install it in the skill folder:\n" +
      "  npm install ajv @templatical/quality\n" +
      "(`ajv` is required; `@templatical/quality` is optional but highly recommended.)",
  );
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(
  readFileSync(resolve(here, "../reference/schema.json"), "utf8"),
);

const ajv = new Ajv({ allErrors: true, strict: false });

// Map a block's `type` discriminator (e.g. "button", "social") to its schema
// definition name (e.g. "ButtonBlock", "SocialIconsBlock"), derived from the
// schema itself so it never drifts from the generated defs.
const typeToDef = {};
for (const [name, def] of Object.entries(schema.definitions)) {
  const constType = def?.properties?.type?.const;
  if (typeof constType === "string") {
    typeToDef[constType] = name;
  }
}

const validatorCache = new Map();
function validatorFor(defName) {
  if (!validatorCache.has(defName)) {
    const definitions = structuredClone(schema.definitions);
    // A section's `children` holds nested blocks (Block[][]); we recurse into
    // them separately for precise paths, so stub the deep check here.
    if (defName === "SectionBlock") {
      definitions.SectionBlock.properties.children = { type: "array" };
    }
    validatorCache.set(
      defName,
      ajv.compile({ $ref: `#/definitions/${defName}`, definitions }),
    );
  }
  return validatorCache.get(defName);
}

const settingsValidator = ajv.compile({
  $ref: "#/definitions/TemplateSettings",
  definitions: structuredClone(schema.definitions),
});

function flattenBlocks(blocks, basePath, out) {
  if (!Array.isArray(blocks)) {
    return;
  }
  blocks.forEach((block, i) => {
    const path = `${basePath}[${i}]`;
    out.push({ path, block });
    if (block?.type === "section" && Array.isArray(block.children)) {
      block.children.forEach((column, ci) => {
        flattenBlocks(column, `${path}.children[${ci}]`, out);
      });
    }
  });
}

function formatAjvErrors(errors, prefix) {
  return (errors ?? []).map((e) => {
    const where = `${prefix}${e.instancePath}`;
    const extra =
      e.keyword === "additionalProperties"
        ? ` (${e.params.additionalProperty})`
        : "";
    return `${where} ${e.message}${extra}`;
  });
}

/**
 * Structural validation. Synchronous, depends only on ajv + the committed
 * schema.json (no build of the workspace packages required).
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTemplate(data) {
  const errors = [];

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["(root) must be an object"] };
  }
  if (!Array.isArray(data.blocks)) {
    errors.push("blocks must be an array");
  }
  if (data.settings === null || typeof data.settings !== "object") {
    errors.push("settings must be an object");
  } else if (!settingsValidator(data.settings)) {
    errors.push(...formatAjvErrors(settingsValidator.errors, "settings"));
  }

  const flat = [];
  flattenBlocks(data.blocks, "blocks", flat);
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

/**
 * Optional quality layer. Resolves to `available: false` (rather than throwing)
 * when @templatical/quality isn't installed, mirroring the editor's optional-peer
 * pattern.
 * @returns {Promise<{ available: boolean, issues: Array<object> }>}
 */
export async function runQualityLint(data) {
  let lintTemplate;
  try {
    ({ lintTemplate } = await import("@templatical/quality"));
  } catch {
    return { available: false, issues: [] };
  }
  // The linter assumes structurally-valid input; guard so a malformed template
  // (which the caller should reject structurally first) can't crash it.
  try {
    return { available: true, issues: lintTemplate(data) ?? [] };
  } catch (err) {
    return { available: true, issues: [], error: err.message };
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/validate.mjs <template.json>");
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
  } catch (err) {
    console.error(`Could not read/parse ${file}: ${err.message}`);
    process.exit(2);
  }

  const { valid, errors } = validateTemplate(data);
  if (!valid) {
    console.error(`✗ Structural validation failed (${errors.length}):`);
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    console.error("Fix the structural errors above, then re-run.");
    process.exit(1);
  }
  console.log("✓ Structural validation passed");

  // Quality linting assumes a structurally-valid template, so it runs only after
  // structural validation passes.
  const quality = await runQualityLint(data);
  if (!quality.available) {
    console.log(
      "• Quality lint skipped — install @templatical/quality (optional but highly recommended) for accessibility/structure/link checks",
    );
    process.exit(0);
  }
  if (quality.error) {
    console.log(`• Quality lint could not run: ${quality.error}`);
    process.exit(0);
  }

  const qErrors = quality.issues.filter((i) => i.severity === "error");
  const qWarnings = quality.issues.filter((i) => i.severity === "warning");
  if (qErrors.length === 0 && qWarnings.length === 0) {
    console.log(`✓ Quality lint passed (${quality.issues.length} info-level)`);
    process.exit(0);
  }

  console.error(
    `⚠ Quality issues (${qErrors.length} error, ${qWarnings.length} warning):`,
  );
  for (const issue of [...qErrors, ...qWarnings]) {
    console.error(`  - [${issue.severity}] ${issue.ruleId}: ${issue.message}`);
  }
  // Errors fail the run; warnings are advisory.
  process.exit(qErrors.length > 0 ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
