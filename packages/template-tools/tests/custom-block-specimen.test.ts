import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createSpacerBlock,
} from "@templatical/types";
import {
  buildSpecimen,
  buildSpecimenTemplate,
} from "../src/custom-block/specimen";

const def = {
  type: "card",
  name: "Card",
  fields: [
    { key: "title", label: "Title", type: "text", default: "Hello" },
    {
      key: "note",
      label: "Note",
      type: "text",
      required: true,
      default: "Keep",
    },
    {
      key: "img",
      label: "Image",
      type: "image",
      default: "https://x.test/a.png",
    },
    { key: "n", label: "N", type: "number", max: 9, default: 2 },
    { key: "on", label: "On", type: "boolean", default: true },
    {
      key: "items",
      label: "Items",
      type: "repeatable",
      minItems: 1,
      maxItems: 3,
      fields: [{ key: "t", label: "T", type: "text", default: "x" }],
    },
  ],
  template: "",
} as never;

const byState = (s: string) =>
  buildSpecimen(def).find((i) => i.state === s)!.fieldValues;

describe("buildSpecimen", () => {
  it("emits every applicable state, in order", () => {
    expect(buildSpecimen(def).map((i) => i.state)).toEqual([
      "defaults",
      "empty",
      "long",
      "min-items",
      "max-items",
      "flipped",
    ]);
  });

  it("omits repeatable and boolean states when no such field exists", () => {
    const plain = {
      type: "p",
      name: "P",
      fields: [{ key: "a", label: "A", type: "text" }],
      template: "",
    } as never;
    expect(buildSpecimen(plain).map((i) => i.state)).toEqual([
      "defaults",
      "empty",
      "long",
    ]);
  });

  it("defaults matches the editor's createCustomBlock defaults", () => {
    expect(byState("defaults")).toEqual({
      title: "Hello",
      note: "Keep",
      img: "https://x.test/a.png",
      n: 2,
      on: true,
      items: [],
    });
  });

  it("empty clears every non-required field and keeps minItems items", () => {
    expect(byState("empty")).toEqual({
      title: "",
      note: "Keep",
      img: "",
      n: null,
      on: false,
      items: [{ t: "x" }],
    });
  });

  it("long triples text and pins numbers to max", () => {
    expect(byState("long")).toMatchObject({
      title: "Hello Hello Hello",
      note: "Keep Keep Keep",
      n: 9,
    });
  });

  it("min-items and max-items size repeatables to their bounds", () => {
    expect(byState("min-items").items).toEqual([{ t: "x" }]);
    expect(byState("max-items").items).toEqual([
      { t: "x" },
      { t: "x" },
      { t: "x" },
    ]);
  });

  it("max-items falls back to 6 without maxItems", () => {
    const d = {
      type: "l",
      name: "L",
      template: "",
      fields: [
        {
          key: "rows",
          label: "Rows",
          type: "repeatable",
          fields: [{ key: "a", label: "A", type: "text" }],
        },
      ],
    } as never;
    expect(
      (
        buildSpecimen(d).find((i) => i.state === "max-items")!.fieldValues
          .rows as unknown[]
      ).length,
    ).toBe(6);
  });

  it("flipped inverts every boolean", () => {
    expect(byState("flipped").on).toBe(false);
  });
});

describe("buildSpecimenTemplate", () => {
  it("labels each instance and appends after the host's own blocks", () => {
    const host = createDefaultTemplateContent();
    host.blocks.push(createSpacerBlock({ id: "h1" }));
    const t = buildSpecimenTemplate(def, host);
    expect(t.blocks[0].id).toBe("h1");
    expect(t.blocks.slice(1).map((b) => b.type)).toEqual(
      Array(6).fill(["paragraph", "custom"]).flat(),
    );
    expect((t.blocks[1] as { content: string }).content).toContain("defaults");
    expect(host.blocks).toHaveLength(1); // host is not mutated
  });

  it("restricts to one state with `only`", () => {
    const t = buildSpecimenTemplate(def, undefined, "flipped");
    expect(t.blocks.map((b) => b.type)).toEqual(["paragraph", "custom"]);
    expect(
      (t.blocks[1] as { fieldValues: { on: boolean } }).fieldValues.on,
    ).toBe(false);
  });
});
