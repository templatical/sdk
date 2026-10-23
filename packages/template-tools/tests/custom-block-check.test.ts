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
    expect(r.valid).toBe(true);
    expect(r.issues.map(({ ruleId, severity, path, excerpt }) => ({ ruleId, severity, path, excerpt }))).toEqual([
      { ruleId: "compat.css-width", severity: "warning", path: "/template", excerpt: "width: 10px" },
    ]);
    const bad = await checkCustomBlock({ ...good, dataSourcePreview: { label: "F", request: { url: "https://x.test/{{ sku }}" }, map: {} } });
    expect(bad.valid).toBe(false);
    expect(bad.issues.map((i) => i.ruleId)).toEqual(["recipe.undefined-variable"]);
  });
  it("raises selected compatibility findings to errors and keeps style-tag as authoring", async () => {
    const r = await checkCustomBlock({ ...good, template: '<style>.tplc-quote-cell{display:flex}</style><script>x</script><p>{{ text }}</p>' });
    expect(r.valid).toBe(false);
    expect(r.issues.map(({ ruleId, severity, path }) => ({ ruleId, severity, path }))).toEqual([
      { ruleId: "safety.style-tag", severity: "warning", path: undefined },
      { ruleId: "compat.css-display-flex", severity: "error", path: "/template" },
      { ruleId: "compat.html-script", severity: "error", path: "/template" },
    ]);
    expect(r.issues.find((issue) => issue.ruleId === "compat.html-script")?.reference).toBe(
      "https://docs.templatical.com/quality/compatibility/rule-catalog#compat-html-script",
    );
  });
  it("checks the definition stylesheet once with a stylesheet path", async () => {
    const r = await checkCustomBlock({ ...good, stylesheet: '.tplc-quote-cell{position:fixed}' });
    expect(r.issues.map(({ ruleId, severity, path }) => ({ ruleId, severity, path }))).toEqual([
      { ruleId: "compat.css-position", severity: "error", path: "/stylesheet" },
    ]);
    expect(r.valid).toBe(false);
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
