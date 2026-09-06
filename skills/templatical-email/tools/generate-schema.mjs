// Generates reference/schema.json (JSON Schema for TemplateContent) directly from
// the canonical types in @templatical/types. This is the single source of truth:
// re-run `pnpm --filter @templatical/email-skill run generate-schema` whenever the
// block model changes. The committed schema.json is what consumers validate against
// (via scripts/validate.mjs), so it must never be hand-edited.
//
// `buildSchema()` is exported so the test suite can regenerate in-memory and assert
// the committed schema.json is fresh (tests/schema-freshness.test.ts) — that guard
// makes a stale schema impossible to merge.
import ts from "typescript";
import {
  DEFAULT_CONFIG,
  SchemaGenerator,
  createFormatter,
  createParser,
} from "ts-json-schema-generator";
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
//
// Spreading DEFAULT_CONFIG is load-bearing and its absence is SILENT: building
// the generator by hand (below) skips the merge `createGenerator` does for us,
// and an unset `jsDoc` drops every `description` from the output — a schema
// that still validates the same templates, so only the freshness diff catches it.
const config = {
  ...DEFAULT_CONFIG,
  path: resolve(repoRoot, "packages/types/src/template.ts"),
  type: "TemplateContent",
  schemaId: "https://templatical.com/schema/template-content.json",
  additionalProperties: false,
  topRef: true,
  sortProps: true,
  skipTypeCheck: true,
};

// TemplateContent is JSON-serializable data — objects, arrays, unions, string
// and number literals — so `lib.es5.d.ts` covers every global it can reference.
// Anything needing a later lib (Map, Promise, Date) could not survive a JSON
// round-trip and does not belong in the block model.
//
// This is why the program is built here instead of via `createGenerator`, whose
// own program loads TypeScript's full default lib: 63 `lib.*.d.ts` files of DOM
// and ESNext declarations, none of which this schema reads. Measured 66 source
// files -> 6, and the cost is I/O, so it is worst exactly where it matters —
// on a cold CI runner. The test that regenerates this schema was landing at
// 4902ms against vitest's 5000ms default, i.e. passing by 98ms.
const COMPILER_OPTIONS = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es5.d.ts"],
  types: [],
  skipLibCheck: true,
  strict: true,
  noEmit: true,
};

/** The TypeScript program the schema is derived from. */
export function createSchemaProgram() {
  return ts.createProgram([config.path], COMPILER_OPTIONS);
}

/** Build the JSON Schema for TemplateContent from the canonical types. */
export function buildSchema() {
  const program = createSchemaProgram();
  return new SchemaGenerator(
    program,
    createParser(program, config),
    createFormatter(config),
    config,
  ).createSchema(config.type);
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
