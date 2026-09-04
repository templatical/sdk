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
    expect(readFileSync(OWN_SCHEMA, "utf8")).toBe(
      serializeSchema(buildSchema()),
    );
  });

  it("the skill's committed schema is byte-identical to this package's", () => {
    // Two copies of one generated artifact. Subsystem C collapses them into a
    // single generator with two outputs; until then this is what stops the
    // validator and the agent disagreeing about what a valid template is.
    expect(readFileSync(SKILL_SCHEMA, "utf8")).toBe(
      readFileSync(OWN_SCHEMA, "utf8"),
    );
  });
});
