import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error -- .mjs generator script, no type declarations by design
import { buildCustomBlockSchema, CUSTOM_BLOCK_SCHEMA_PATH, SKILL_CUSTOM_BLOCK_SCHEMA_PATH, serializeSchema } from "../scripts/generate-schema.mjs";

const onDisk = () => readFileSync(CUSTOM_BLOCK_SCHEMA_PATH, "utf8");

describe("custom-block-schema.json", () => {
  it("matches a fresh generation from @templatical/types", () => {
    expect(JSON.parse(onDisk())).toEqual(buildCustomBlockSchema());
  });

  it("is written exactly as the generator serializes it", () => {
    expect(onDisk()).toBe(serializeSchema(buildCustomBlockSchema()));
  });

  it("is byte-identical to the skill's copy", () => {
    expect(readFileSync(SKILL_CUSTOM_BLOCK_SCHEMA_PATH, "utf8")).toBe(onDisk());
  });

  it("drops the function-valued dataSource and keeps the required set", () => {
    const def = JSON.parse(onDisk()).definitions.CustomBlockDefinition;
    expect(Object.keys(def.properties).sort()).toEqual([
      "defaultStyles",
      "description",
      "fields",
      "icon",
      "name",
      "stylesheet",
      "template",
      "type",
    ]);
    expect([...def.required].sort()).toEqual([
      "fields",
      "name",
      "template",
      "type",
    ]);
    expect(def.additionalProperties).toBe(false);
  });
});
