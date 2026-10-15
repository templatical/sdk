import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { checkCustomBlock } from "../src/custom-block/check";

const good = {
  type: "quote", name: "Quote",
  fields: [{ key: "text", label: "Text", type: "textarea", default: "Hi" }],
  template: '<table role="presentation" width="100%"><tr><td class="tplc-quote-cell">{{ text }}</td></tr></table>',
  stylesheet: ".tplc-quote-cell { font-style: italic; }",
};
const compile = async (m: string) => ({ errors: (await mjml2html(m, { validationLevel: "soft" })).errors });

describe("checkCustomBlock", () => {
  it("passes a clean definition through every stage with no issues", async () => {
    expect(await checkCustomBlock(good, { compileMjml: compile })).toEqual({ valid: true, issues: [] });
  });
  it("stops after a structural failure", async () => {
    const r = await checkCustomBlock({ ...good, fields: "nope" });
    expect(r.valid).toBe(false);
    expect(new Set(r.issues.map((i) => i.ruleId))).toEqual(new Set(["schema"]));
  });
  it("stops rendering after a Liquid parse error", async () => {
    const r = await checkCustomBlock({ ...good, template: "{% if text %}" });
    expect(r.issues.map((i) => i.ruleId)).toEqual(["liquid.parse"]);
  });
  it("combines liquid, safety and recipe findings; warnings alone stay valid", async () => {
    const r = await checkCustomBlock({ ...good, template: `<div style="width:10px">{{ text }}</div>` });
    expect(r).toEqual({ valid: true, issues: [expect.objectContaining({ ruleId: "safety.div-layout", severity: "warning" })] });
    const bad = await checkCustomBlock({ ...good, dataSourcePreview: { label: "F", request: { url: "https://x.test/{{ sku }}" }, map: {} } });
    expect(bad.valid).toBe(false);
    expect(bad.issues.map((i) => i.ruleId)).toEqual(["recipe.undefined-variable"]);
  });
  it("reports a template that throws while rendering as an error, not a crash", async () => {
    const r = await checkCustomBlock({ ...good, template: `${good.template}{{ "2024-01-01" | date: "%Y", "Not/AZone" }}` });
    expect(r).toEqual({
      valid: false,
      issues: [{
        ruleId: "liquid.render",
        severity: "error",
        path: "/template",
        message: expect.stringMatching(/^The template does not render: Invalid time zone specified: Not\/AZone/),
      }],
    });
  });
  it("stops before rendering a template that loads another file", async () => {
    const r = await checkCustomBlock({ ...good, template: `${good.template}{% include 'package.json' %}` });
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.ruleId)).toEqual(["liquid.file-tag"]);
  });
  it("accepts a stylesheet with the whitespace a template literal carries", async () => {
    const stylesheet = "\n  .tplc-quote-cell { font-style: italic; }\n\n";
    expect(await checkCustomBlock({ ...good, stylesheet }, { compileMjml: compile })).toEqual({ valid: true, issues: [] });
    expect(await checkCustomBlock({ ...good, stylesheet: "  \r\n" })).toEqual({ valid: true, issues: [] });
  });
  it("adds accessibility warnings, which leave the definition valid", async () => {
    const r = await checkCustomBlock({ ...good, template: "<table><tr><td>{{ text }}</td></tr></table>" });
    expect(r).toEqual({ valid: true, issues: [expect.objectContaining({ ruleId: "a11y.table-role", severity: "warning" })] });
  });
  it("surfaces MJML compile errors as warnings", async () => {
    const r = await checkCustomBlock(good, { compileMjml: async () => ({ errors: [{ formattedMessage: "boom" }] }) });
    expect(r).toEqual({ valid: true, issues: [expect.objectContaining({ ruleId: "render.mjml", severity: "warning", message: "boom" })] });
  });
});
