// Generates reference/schema.json (JSON Schema for TemplateContent) directly from
// the canonical types in @templatical/types. This is the single source of truth:
// re-run `pnpm --filter @templatical/email-skill run generate-schema` whenever the
// block model changes. The committed schema.json is what consumers validate against
// (via scripts/validate.mjs), so it must never be hand-edited.
//
// `buildSchema()` is exported so the test suite can regenerate in-memory and assert
// the committed schema.json is fresh (tests/schema-freshness.test.ts) — that guard
// makes a stale schema impossible to merge.
import { createGenerator } from "ts-json-schema-generator";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

export const SCHEMA_PATH = resolve(here, "../reference/schema.json");

// No `tsconfig`: the repo compiles with TS 6, whose tsconfig carries options
// (e.g. `ignoreDeprecations: "6.0"`) that the generator's bundled TypeScript
// rejects. TemplateContent's type graph is self-contained under
// packages/types/src, so an isolated program built from the entry file is
// sufficient. `skipTypeCheck` avoids failing on lib types absent in isolation.
// `sortProps` keeps output deterministic so the freshness test is stable.
const config = {
  path: resolve(repoRoot, "packages/types/src/template.ts"),
  type: "TemplateContent",
  schemaId: "https://templatical.com/schema/template-content.json",
  additionalProperties: false,
  topRef: true,
  sortProps: true,
  skipTypeCheck: true,
};

/** Build the JSON Schema for TemplateContent from the canonical types. */
export function buildSchema() {
  return createGenerator(config).createSchema(config.type);
}

/** Serialize a schema object the same way the committed file is written. */
export function serializeSchema(schema) {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

function main() {
  const schema = buildSchema();
  mkdirSync(dirname(SCHEMA_PATH), { recursive: true });
  writeFileSync(SCHEMA_PATH, serializeSchema(schema), "utf8");
  const defCount = Object.keys(schema.definitions ?? {}).length;
  console.log(`Wrote ${SCHEMA_PATH} (${defCount} definitions)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
