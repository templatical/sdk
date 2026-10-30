import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import type { CustomBlockWorkingFile } from "../src/custom-block/types";
import { buildSpecimenTemplate } from "../src/custom-block/specimen";
import { renderSpecimenMjml, renderStates } from "../src/custom-block/render";

const def = {
  type: "badge",
  name: "Badge",
  fields: [
    { key: "label", label: "Label", type: "text", default: "New" },
    { key: "on", label: "On", type: "boolean", default: true },
  ],
  template: '<table role="presentation"><tr><td class="tplc-badge-cell">{% if on %}{{ label }}{% endif %}</td></tr></table>',
  stylesheet: ".tplc-badge-cell { color: #c00; }",
} as never;

describe("renderStates", () => {
  it("renders each specimen state with the editor's Liquid semantics", async () => {
    const out = await renderStates(def);
    expect(out.map((s) => s.state)).toEqual(["defaults", "empty", "long", "flipped"]);
    expect(out[0].html).toContain(">New<");
    expect(out.find((s) => s.state === "flipped")!.html).not.toContain("New");
  });
});

describe("renderSpecimenMjml", () => {
  it("puts the stylesheet in <mj-head> exactly once and the block in <mj-text>", async () => {
    const mjml = await renderSpecimenMjml(def);
    const head = mjml.slice(0, mjml.indexOf("</mj-head>"));
    expect(head.split(".tplc-badge-cell { color: #c00; }").length - 1).toBe(1);
    expect(mjml).toContain("<mj-text");
    expect(mjml).toContain("New New New");
  });

  it("compiles to HTML through mjml@5 with the block content present", async () => {
    const { html, errors } = await mjml2html(await renderSpecimenMjml(def), { validationLevel: "soft" });
    expect(errors).toEqual([]);
    expect(html).toContain("tplc-badge-cell");
    expect(html).toContain("New New New");
  });
});


describe("escaped specimen fields", () => {
  const escapedDef: CustomBlockWorkingFile = {
    type: 'escaped', name: 'Escaped',
    fields: [{ key: 'body', label: 'Body', type: 'text', default: '<script>alert(1)</script> & "quoted"' }],
    template: '<p>{{ body }}</p>',
  };
  const expected = '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &#34;quoted&#34;</p>';

  it("escapes field values in renderStates", async () => {
    const states = await renderStates(escapedDef);
    expect(states[0].html).toBe(expected);
  });

  it("preserves escaped HTML in the specimen MJML", async () => {
    const template = buildSpecimenTemplate(escapedDef);
    template.blocks = template.blocks.filter((block) => block.type === 'custom');
    const mjml = await renderSpecimenMjml(escapedDef, template);
    expect(mjml.match(/<p>[\s\S]*?<\/p>/)?.[0]).toBe(expected);
  });
});
