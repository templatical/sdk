import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error -- .mjs generator script, no type declarations by design
import { buildSchema, SCHEMA_PATH } from "../scripts/generate-schema.mjs";
import { schema as committed } from "../src/validate";

describe("schema.json freshness", () => {
  it("matches a fresh generation from @templatical/types", () => {
    // Regenerating in-memory and deep-equalling the committed file makes a
    // stale schema impossible to merge: any block-model change that isn't
    // followed by `generate-schema` fails here.
    expect(committed).toEqual(buildSchema());
  });

  it("is written exactly as the generator serializes it", () => {
    const onDisk = readFileSync(SCHEMA_PATH, "utf8");
    expect(onDisk).toBe(`${JSON.stringify(committed, null, 2)}\n`);
  });
});

describe("schema shape", () => {
  it("declares every block type the editor supports", () => {
    const types = Object.values(
      committed.definitions as Record<
        string,
        { properties?: { type?: { const?: unknown } } }
      >,
    )
      .map((d) => d.properties?.type?.const)
      .filter((t): t is string => typeof t === "string")
      .sort();

    expect(types).toEqual([
      "button",
      "countdown",
      "custom",
      "divider",
      "html",
      "image",
      "menu",
      "paragraph",
      "section",
      "social",
      "spacer",
      "table",
      "title",
      "video",
    ]);
  });

  it("rejects unknown properties on every block definition", () => {
    // The root is a bare $ref (topRef: true), so the closed-world guarantee
    // lives on the definitions rather than at the top level.
    const blockDefs = Object.entries(
      committed.definitions as Record<
        string,
        { additionalProperties?: boolean; properties?: { type?: unknown } }
      >,
    ).filter(([, def]) => def.properties?.type !== undefined);

    expect(blockDefs.length).toBeGreaterThan(0);
    const permissive = blockDefs
      .filter(([, def]) => def.additionalProperties !== false)
      .map(([name]) => name);
    expect(permissive).toEqual([]);
  });
});
