import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error -- .mjs generator script, no type declarations by design
import { buildCustomBlockSchema, CUSTOM_BLOCK_SCHEMA_PATH, forbidNestedRepeatables, SKILL_CUSTOM_BLOCK_SCHEMA_PATH, serializeSchema } from "../scripts/generate-schema.mjs";

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

  it("narrows a repeatable's sub-fields to the union without repeatables", () => {
    const defs = JSON.parse(onDisk()).definitions;
    expect(defs.CustomBlockRepeatableField.properties.fields.items).toEqual({
      $ref: "#/definitions/CustomBlockRepeatableItemField",
    });
    expect(defs.CustomBlockRepeatableItemField.anyOf.map((r: { $ref: string }) => r.$ref)).toEqual(
      defs.CustomBlockField.anyOf
        .map((r: { $ref: string }) => r.$ref)
        .filter((ref: string) => ref !== "#/definitions/CustomBlockRepeatableField"),
    );
  });

  it("throws on a schema it no longer recognises, rather than leaving nesting allowed", () => {
    const shaped = (items: object) => ({
      definitions: {
        CustomBlockField: { anyOf: [{ $ref: "#/definitions/CustomBlockTextField" }] },
        CustomBlockRepeatableField: { properties: { fields: { type: "array", items } } },
      },
    });
    const message = "generate-schema: CustomBlockField's shape changed; revisit forbidNestedRepeatables.";
    expect(() => forbidNestedRepeatables(shaped({ $ref: "#/definitions/CustomBlockField" }))).toThrow(message);
    expect(() => forbidNestedRepeatables({ definitions: {} })).toThrow(message);
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
