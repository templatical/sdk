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

  it("accepts the object a consumer's module exports, dataSource function included", () => {
    expect(
      validateCustomBlockDefinition({
        ...TESTIMONIAL,
        dataSource: { label: "Fetch", onFetch: async () => ({}) },
      }),
    ).toEqual({ valid: true, issues: [] });
  });

  it("points a JSON dataSource at dataSourcePreview, and requires a label", () => {
    expect(
      validateCustomBlockDefinition({
        ...TESTIMONIAL,
        dataSource: { label: "x", onFetch: "fetch()" },
      }).issues,
    ).toEqual([
      {
        ruleId: "schema",
        severity: "error",
        path: "/dataSource",
        message:
          "`dataSource.onFetch` must be a function. A JSON working file can't hold one: preview with `dataSourcePreview`, and write `dataSource` in the module at handoff.",
      },
    ]);
    expect(
      validateCustomBlockDefinition({
        ...TESTIMONIAL,
        dataSource: { onFetch: async () => null },
      }).issues.map((i) => i.message),
    ).toEqual(["`dataSource.label` must be a non-empty string."]);
  });

  it("rejects a repeatable nested inside a repeatable, as the TS type does", () => {
    const r = validateCustomBlockDefinition({
      ...TESTIMONIAL,
      fields: [
        {
          key: "rows",
          label: "Rows",
          type: "repeatable",
          fields: [
            {
              key: "cells",
              label: "Cells",
              type: "repeatable",
              fields: [{ key: "t", label: "T", type: "text" }],
            },
          ],
        },
      ],
    });
    expect(r.valid).toBe(false);
    expect(new Set(ids(r))).toEqual(new Set(["schema"]));
    expect(r.issues.some((i) => i.path?.startsWith("/fields/0/fields/0"))).toBe(true);
  });

  it("flags bounds no value or list length can satisfy", () => {
    const repeatable = (extra: object) => ({
      key: "items",
      label: "Items",
      type: "repeatable",
      fields: [{ key: "t", label: "T", type: "text" }],
      ...extra,
    });
    const run = (field: object) =>
      validateCustomBlockDefinition({ ...TESTIMONIAL, fields: [field] }).issues.map(
        (i) => `${i.ruleId} ${i.path}`,
      );
    expect(run({ key: "n", label: "N", type: "number", min: 10, max: 1 })).toEqual([
      "field.range /fields/0",
    ]);
    expect(run(repeatable({ minItems: 5, maxItems: 2 }))).toEqual([
      "field.items-range /fields/0",
    ]);
    expect(run(repeatable({ minItems: 1.5 }))).toEqual(["field.items-range /fields/0"]);
    expect(run(repeatable({ minItems: 2, default: [{ t: "a" }] }))).toEqual([
      "field.default-items /fields/0/default",
    ]);
    expect(run(repeatable({ maxItems: 1, default: [{ t: "a" }, { t: "b" }] }))).toEqual([
      "field.default-items /fields/0/default",
    ]);
    expect(run(repeatable({ minItems: 1, maxItems: 3, default: [{ t: "a" }] }))).toEqual([]);
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
