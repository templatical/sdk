// Generates schema.json (JSON Schema for TemplateContent) directly from the
// canonical types in @templatical/types. This is the single source of truth for
// every consumer that validates a Templatical template — this package's own
// `validate`/`schema` CLI commands, and the templatical Agent Skill.
//
// This script writes THREE files from one schema object: this package's own
// schema.json, skills/templatical/reference/schema.json, and the per-type
// field lists inside skills/templatical/reference/block-guide.md. The skill
// needs its schema copy committed in the repo because the agent reads it in
// context to generate templates — the CLI's `schema` command exists for other
// callers and does not replace the file. A package script reaching into
// skills/ looks odd until you consider the alternative: two separate
// generators producing what is supposed to be one artifact, which is exactly
// how the validator and the agent end up disagreeing about what a valid
// template is. One generator writing every output makes that impossible.
//
// The guide's field lists live between `<!-- BEGIN/END GENERATED FIELDS: x -->`
// markers; everything outside them is hand-written guidance and is preserved
// verbatim. `countdown` and `custom` carry no markers — the skill never emits
// them — and `applyGuideRegions` skips any type whose BEGIN marker is absent.
//
// Re-run `pnpm --filter @templatical/template-tools run generate-schema` whenever
// the block model changes. Neither committed copy should ever be hand-edited.
//
// `buildSchema()` is exported so the test suite can regenerate in-memory and
// assert both committed copies are fresh and identical
// (tests/schema-freshness.test.ts, tests/schema-parity.test.ts) — that guard
// makes a stale or diverged schema impossible to merge.
import ts from "typescript";
import {
  DEFAULT_CONFIG,
  SchemaGenerator,
  createFormatter,
  createParser,
} from "ts-json-schema-generator";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

export const SCHEMA_PATH = resolve(here, "../schema.json");
export const SKILL_SCHEMA_PATH = resolve(
  repoRoot,
  "skills/templatical/reference/schema.json",
);

// The block guide's per-type field lists are generated into marker pairs in
// this file, from the same schema object written above. Its prose outside
// those markers is hand-written and never touched.
export const SKILL_GUIDE_PATH = resolve(
  repoRoot,
  "skills/templatical/reference/block-guide.md",
);

// Documented once under "## Common block fields"; repeating them per block is
// what made a naive generated list larger than the hand-written text.
const COMMON_FIELDS = new Set([
  "id",
  "type",
  "styles",
  "visibility",
  "displayCondition",
]);

/** A property's type, rendered the way the guide writes types. */
export function renderType(spec) {
  if (!spec || typeof spec !== "object") return "?";
  if (spec.$ref) return spec.$ref.split("/").pop();
  // Before `enum`, and reached again through `anyOf`: a literal member of a
  // union carries `const`, so handling it later renders `width` as
  // `int | string` instead of `int | "full"`.
  if (spec.const !== undefined) return JSON.stringify(spec.const);
  if (Array.isArray(spec.enum)) {
    return spec.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  if (Array.isArray(spec.anyOf)) {
    return spec.anyOf.map(renderType).join(" | ");
  }
  if (spec.type === "array") return `${renderType(spec.items)}[]`;
  // `number` renders as `int` because every numeric field in the block model
  // is a pixel dimension, and the guide's preamble states that convention.
  return (
    {
      string: "string",
      number: "int",
      integer: "int",
      boolean: "bool",
      object: "object",
    }[spec.type] ?? String(spec.type ?? "?")
  );
}

/** Block type -> the generated field-list body for its markers. */
export function buildGuideRegions(schema) {
  const regions = new Map();
  for (const definition of Object.values(schema.definitions ?? {})) {
    const blockType = definition.properties?.type?.const;
    if (!blockType) continue;
    const props = definition.properties ?? {};
    const required = new Set(definition.required ?? []);
    const render = (names) =>
      names.map((name) => `\`${name}\` (${renderType(props[name])})`).join(", ");
    const names = Object.keys(props).filter((n) => !COMMON_FIELDS.has(n));
    const req = render(names.filter((n) => required.has(n)));
    const opt = render(names.filter((n) => !required.has(n)));
    const lines = [];
    if (req) lines.push(`**Required** — ${req}.`);
    if (opt) lines.push(`**Optional** — ${opt}.`);
    regions.set(blockType, lines.join("\n"));
  }
  return regions;
}

/** Pure: `src` with each marker pair's body replaced. Throws on a mismatch. */
export function applyGuideRegions(src, regions) {
  let out = src;
  for (const [blockType, body] of regions) {
    const begin = `<!-- BEGIN GENERATED FIELDS: ${blockType} -->`;
    const end = `<!-- END GENERATED FIELDS: ${blockType} -->`;
    if (!out.includes(begin)) continue; // never-emitted types carry no markers
    const pattern = new RegExp(
      `${begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    );
    out = out.replace(pattern, `${begin}\n${body}\n${end}`);
  }
  // The half freshness cannot catch: a marker for a block type the schema no
  // longer declares is never rewritten, so a regenerate-and-compare passes.
  const orphans = [...out.matchAll(/<!-- BEGIN GENERATED FIELDS: ([a-z]+) -->/g)]
    .map(([, t]) => t)
    .filter((t) => !regions.has(t));
  if (orphans.length > 0) {
    throw new Error(
      `block-guide.md has generated-field markers for types the schema does ` +
        `not declare: ${orphans.join(", ")}. Remove the section or fix the type.`,
    );
  }
  return out;
}

// No `tsconfig`: the repo compiles with TS 6, whose tsconfig carries options
// (e.g. `ignoreDeprecations: "6.0"`) that the generator's bundled TypeScript
// rejects. TemplateContent's type graph is self-contained under
// packages/types/src, so an isolated program built from the entry file is
// sufficient. `skipTypeCheck` avoids failing on lib types absent in isolation.
// `sortProps` keeps output deterministic so the freshness test is stable.
//
// Spreading DEFAULT_CONFIG is load-bearing and its absence is SILENT:
// building the generator by hand (below) skips the merge `createGenerator`
// does for us, and an unset `jsDoc` drops every `description` from the
// output — a schema that still validates the same templates, so only the
// freshness diff catches it.
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
// files -> 6, and the cost is I/O, so it is worst exactly where it matters — on
// a cold CI runner, where the test that regenerates this schema was landing at
// 4902ms against vitest's 5000ms default.
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
  const serialized = serializeSchema(schema);
  for (const path of [SCHEMA_PATH, SKILL_SCHEMA_PATH]) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, serialized, "utf8");
  }
  const regions = buildGuideRegions(schema);
  const guide = applyGuideRegions(
    readFileSync(SKILL_GUIDE_PATH, "utf8"),
    regions,
  );
  writeFileSync(SKILL_GUIDE_PATH, guide, "utf8");
  const defCount = Object.keys(schema.definitions ?? {}).length;
  const guideCount = [
    ...guide.matchAll(/<!-- BEGIN GENERATED FIELDS: [a-z]+ -->/g),
  ].length;
  console.log(`Wrote ${SCHEMA_PATH} (${defCount} definitions)`);
  console.log(`Wrote ${SKILL_SCHEMA_PATH} (${defCount} definitions)`);
  console.log(`Wrote ${SKILL_GUIDE_PATH} (${guideCount} generated field lists)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
