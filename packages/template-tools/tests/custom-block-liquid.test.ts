import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkLiquid } from "../src/custom-block/liquid";

const base = {
  type: "features",
  name: "Features",
  fields: [
    { key: "heading", label: "Heading", type: "text" },
    { key: "items", label: "Items", type: "repeatable", fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "url", label: "URL", type: "text" },
    ] },
  ],
  template: "<h2>{{ heading }}</h2>{% for item in items %}<a href=\"{{ item.url }}\">{{ item.title }}</a>{{ forloop.index }}{% endfor %}",
} as const;

const run = (patch: object) => checkLiquid({ ...base, ...patch } as never);

describe("checkLiquid", () => {
  it("passes a template whose reads match the field model", () => {
    expect(run({})).toEqual([]);
  });

  it("reports a parse error and stops", () => {
    const issues = run({ template: "{% if heading %}<h2>" });
    expect(issues.map((i) => i.ruleId)).toEqual(["liquid.parse"]);
    expect(issues[0].severity).toBe("error");
  });

  it("errors on a variable no field defines", () => {
    const issues = run({ template: `${base.template}{{ subtitle }}` });
    expect(issues).toEqual([expect.objectContaining({ ruleId: "liquid.undefined-variable", severity: "error" })]);
    expect(issues[0].message).toContain("`subtitle`");
  });

  it("warns on a field the template never reads", () => {
    const issues = run({ template: "{% for item in items %}{{ item.title }}{{ item.url }}{% endfor %}" });
    expect(issues).toEqual([expect.objectContaining({ ruleId: "liquid.unused-field", severity: "warning", path: "/fields/0" })]);
  });

  it("errors on a repeatable sub-key the repeatable doesn't define", () => {
    const issues = run({ template: `${base.template}{% for x in items %}{{ x.image }}{% endfor %}` });
    expect(issues.map((i) => i.ruleId)).toEqual(["liquid.unknown-item-key"]);
    expect(issues[0].message).toContain("`image`");
  });

  it("errors when a loop iterates a field that isn't repeatable", () => {
    const issues = run({ template: `${base.template}{% for c in heading %}{{ c }}{% endfor %}` });
    expect(issues.map((i) => i.ruleId)).toEqual(["liquid.loop-not-repeatable"]);
  });

  it("scopes a loop local to its own loop when two loops share the name", () => {
    const fields = [
      ...base.fields,
      { key: "links", label: "Links", type: "repeatable", fields: [{ key: "href", label: "Href", type: "text" }] },
    ];
    const template = `${base.template}{% for item in links %}{{ item.href }}{% endfor %}`;
    expect(run({ fields, template })).toEqual([]);
  });

  it("still flags a sub-key the loop's own collection lacks when the local is reused", () => {
    const fields = [
      ...base.fields,
      { key: "links", label: "Links", type: "repeatable", fields: [{ key: "href", label: "Href", type: "text" }] },
    ];
    const issues = run({ fields, template: `${base.template}{% for item in links %}{{ item.title }}{% endfor %}` });
    expect(issues.map((i) => i.ruleId)).toEqual(["liquid.unknown-item-key"]);
    expect(issues[0].message).toBe("`item.title` reads `title`, which `links`'s items don't define.");
  });

  it("does not treat a dotted collection as iterating its head field", () => {
    const issues = run({ template: `${base.template}{% for c in heading.sub %}{{ c }}{% endfor %}` });
    expect(issues).toEqual([]);
  });

  it("checks loops nested inside other tags", () => {
    const issues = run({ template: `${base.template}{% if heading %}{% for c in heading %}{{ c }}{% endfor %}{% endif %}` });
    expect(issues.map((i) => i.ruleId)).toEqual(["liquid.loop-not-repeatable"]);
  });

  it("uses exactly the editor's engine options", () => {
    const editor = readFileSync(resolve(import.meta.dirname,
      "../../editor/src/composables/useBlockRegistry.ts"), "utf8");
    const mine = readFileSync(resolve(import.meta.dirname, "../src/custom-block/liquid.ts"), "utf8");
    for (const option of ["strictVariables: false", "strictFilters: false"]) {
      expect(editor).toContain(option);
      expect(mine).toContain(option);
    }
  });
});
