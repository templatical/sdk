import { describe, expect, it } from "vitest";
import { validateCustomBlockDefinition } from "../src/custom-block/definition";

const TESTIMONIAL = {
  type: "testimonial",
  name: "Testimonial",
  fields: [
    {
      key: "quote",
      label: "Quote",
      type: "textarea",
      default: "Great product.",
    },
    {
      key: "author",
      label: "Author",
      type: "text",
      required: true,
      default: "Ada",
    },
    { key: "avatar", label: "Avatar", type: "image" },
    {
      key: "rating",
      label: "Rating",
      type: "number",
      min: 1,
      max: 5,
      default: 5,
    },
    { key: "showRating", label: "Show rating", type: "boolean", default: true },
  ],
  template:
    '<table role="presentation" width="100%"><tr><td>{% if showRating %}{{ rating }}{% endif %}<p>{{ quote }}</p>{% if avatar %}<img src="{{ avatar }}" alt="{{ author }}" width="40">{% endif %}<p>{{ author }}</p></td></tr></table>',
};

const ids = (r: { issues: { ruleId: string }[] }) =>
  r.issues.map((i) => i.ruleId);

describe("validateCustomBlockDefinition", () => {
  it("accepts a well-formed definition with no issues", () => {
    expect(validateCustomBlockDefinition(TESTIMONIAL)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("rejects a non-object", () => {
    const r = validateCustomBlockDefinition([]);
    expect(r.valid).toBe(false);
    expect(ids(r)).toEqual(["schema"]);
  });

  it("reports a missing required property with its path", () => {
    const { template: _t, ...rest } = TESTIMONIAL;
    const r = validateCustomBlockDefinition(rest);
    expect(r.valid).toBe(false);
    expect(r.issues[0]).toMatchObject({ ruleId: "schema", severity: "error" });
    expect(r.issues[0].message).toContain("template");
  });

  it("rejects dataSource in the working file (it is code, written at handoff)", () => {
    const r = validateCustomBlockDefinition({
      ...TESTIMONIAL,
      dataSource: { label: "x" },
    });
    expect(r.valid).toBe(false);
    expect(ids(r)).toEqual(["schema"]);
  });

  it("accepts a dataSourcePreview recipe and rejects a malformed one", () => {
    const recipe = {
      label: "Fetch",
      request: { url: "https://x.test/{{ author }}" },
      map: { quote: "q" },
    };
    expect(
      validateCustomBlockDefinition({
        ...TESTIMONIAL,
        dataSourcePreview: recipe,
      }).valid,
    ).toBe(true);
    const bad = validateCustomBlockDefinition({
      ...TESTIMONIAL,
      dataSourcePreview: { label: "Fetch" },
    });
    expect(bad.valid).toBe(false);
    expect(ids(bad)).toEqual(["schema"]);
    expect(bad.issues[0].path).toBe("/dataSourcePreview");
  });

  it("flags duplicate field keys, including inside a repeatable", () => {
    const r = validateCustomBlockDefinition({
      ...TESTIMONIAL,
      fields: [
        ...TESTIMONIAL.fields,
        { key: "quote", label: "Dup", type: "text" },
        {
          key: "items",
          label: "Items",
          type: "repeatable",
          fields: [
            { key: "t", label: "T", type: "text" },
            { key: "t", label: "T2", type: "text" },
          ],
        },
      ],
    });
    expect(r.valid).toBe(false);
    expect(ids(r)).toEqual(["field.duplicate-key", "field.duplicate-key"]);
    expect(r.issues.map((i) => i.path)).toEqual([
      "/fields/5",
      "/fields/6/fields/1",
    ]);
  });

  it("flags a number default outside min/max and a select default not in options", () => {
    const r = validateCustomBlockDefinition({
      ...TESTIMONIAL,
      fields: [
        { key: "n", label: "N", type: "number", min: 1, max: 5, default: 9 },
        {
          key: "s",
          label: "S",
          type: "select",
          options: [{ label: "A", value: "a" }],
          default: "b",
        },
      ],
      template: "{{ n }}{{ s }}",
    });
    expect(r.valid).toBe(false);
    expect(ids(r)).toEqual(["field.default-range", "field.default-option"]);
  });
});
