import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildSchema, SCHEMA_PATH } from "../scripts/generate-schema.mjs";

describe("schema freshness", () => {
  // Regenerate the schema from @templatical/types and compare to the committed
  // reference/schema.json. This makes a stale schema impossible to merge: any
  // change to the block model (a new/renamed field, a new block type, an enum
  // tweak) that isn't followed by `generate-schema` fails here.
  it("committed schema.json matches a fresh generation from @templatical/types", () => {
    const committed = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    const fresh = buildSchema();
    expect(
      fresh,
      "schema.json is stale — run `pnpm --filter @templatical/email-skill run generate-schema` and commit the result",
    ).toEqual(committed);
  });
});
