import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildSchema,
  createSchemaProgram,
  SCHEMA_PATH,
} from "../tools/generate-schema.mjs";

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

  // The schema is derived from a hand-built TypeScript program precisely so it
  // does NOT load TypeScript's full default lib. Reverting to the library's own
  // `createGenerator` pulls in 63 `lib.*.d.ts` files of DOM/ESNext declarations
  // (66 source files rather than 6) for a schema that reads none of them. That
  // cost is I/O, so it lands hardest on a cold CI runner: this suite's
  // regeneration was measured at 4902ms against vitest's 5000ms default.
  it("derives the schema from a minimal TypeScript program", () => {
    const files = createSchemaProgram()
      .getSourceFiles()
      .map((f) => f.fileName);
    const libs = files.filter((name) => /lib\..*\.d\.ts$/.test(name));

    expect(files.length).toBeLessThanOrEqual(12);
    expect(libs.length).toBeLessThanOrEqual(6);
  });

  // Guards a silent failure mode: the hand-built generator skips the
  // DEFAULT_CONFIG merge `createGenerator` performs, and an unset `jsDoc` drops
  // every description while still producing a schema that validates identically.
  it("keeps the JSDoc descriptions the block guide relies on", () => {
    const schema = buildSchema() as {
      definitions: Record<string, { description?: string }>;
    };
    const described = Object.values(schema.definitions).filter(
      (d) => typeof d.description === "string" && d.description.length > 0,
    );
    expect(described.length).toBeGreaterThan(0);
  });
});
