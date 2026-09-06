import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error — plain .mjs generator, no types
import { buildSchema, serializeSchema } from "../scripts/generate-schema.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SKILL_SCHEMA = resolve(
  REPO_ROOT,
  "skills/templatical-email/reference/schema.json",
);
const OWN_SCHEMA = resolve(import.meta.dirname, "../schema.json");

describe("schema parity", () => {
  it("this package's committed schema is what the generator produces", () => {
    // 30s, not the 5s default: this spawns a TypeScript program over
    // packages/types via ts-json-schema-generator. It finishes in well under
    // a second alone, but `pnpm run test` runs 13 packages concurrently and
    // that is what CI does, so the default timeout flakes under load — a
    // failure that reads as a stale schema rather than a busy machine.
    expect(readFileSync(OWN_SCHEMA, "utf8")).toBe(
      serializeSchema(buildSchema()),
    );
  }, 30_000);

  it("the skill's committed schema is byte-identical to this package's", () => {
    // Two copies of one generated artifact, written by the one generator
    // imported above (see its header comment in scripts/generate-schema.mjs
    // for why a package script reaches into skills/). This asserts the two
    // copies have not been hand-edited apart from each other, on top of the
    // previous case already asserting this package's copy against a fresh
    // generation — together the two cases cover both committed files against
    // the generator.
    expect(readFileSync(SKILL_SCHEMA, "utf8")).toBe(
      readFileSync(OWN_SCHEMA, "utf8"),
    );
  });
});
