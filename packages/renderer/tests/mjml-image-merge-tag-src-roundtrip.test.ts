import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { createDefaultTemplateContent, createImageBlock } from "@templatical/types";
import { renderToMjml } from "../src";

async function render(src: string) {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createImageBlock({
      src,
      placeholderUrl: "https://example.com/qr-placeholder.png",
    }),
  ];
  const mjml = await renderToMjml(content);
  const result = await mjml2html(mjml, { validationLevel: "strict" });
  expect(result.errors).toEqual([]);
  return { mjml, html: result.html };
}

describe("image merge-tag source through MJML", () => {
  it("keeps a merge-tag image source and omits its editor preview", async () => {
    const { mjml, html } = await render("{{recipient.qr_code}}");
    expect(mjml).toContain('src="{{recipient.qr_code}}"');
    expect(html.match(/<img\b[^>]*src="([^"]*)"/)?.[1]).toBe(
      "{{recipient.qr_code}}",
    );
    expect(mjml).not.toContain("qr-placeholder.png");
    expect(html).not.toContain("qr-placeholder.png");
  });

  it("escapes quotes in a Liquid filter without changing its source", async () => {
    const { mjml, html } = await render('{{ recipient.qr | default: "x" }}');
    expect(mjml).toContain('src="{{ recipient.qr | default: &quot;x&quot; }}"');
    expect(html.match(/<img\b[^>]*src="([^"]*)"/)?.[1]).toBe(
      "{{ recipient.qr | default: &quot;x&quot; }}",
    );
    expect(mjml).not.toContain("qr-placeholder.png");
    expect(html).not.toContain("qr-placeholder.png");
  });
});
