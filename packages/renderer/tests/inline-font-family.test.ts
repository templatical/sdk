import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
} from "@templatical/types";
import { renderToMjml } from "../src";

const customFonts = [
  {
    name: "Montserrat",
    url: "https://fonts.example.com/montserrat.css",
    fallback: "Arial, Helvetica, sans-serif",
  },
];

async function render(
  content: string,
  options: Parameters<typeof renderToMjml>[1] = {},
) {
  const template = createDefaultTemplateContent();
  return renderToMjml(
    { ...template, blocks: [createParagraphBlock({ content })] },
    { customFonts, ...options },
  );
}

describe("inline rich-text font fallbacks", () => {
  it("expands a custom font on a nested span and preserves its other styles and attributes", async () => {
    const mjml = await render(
      '<p><span title="keep" style="color: red; font-family: Montserrat; font-weight: 700">Hi</span></p>',
    );

    expect(mjml).toContain(
      '<span title="keep" style="color: red; font-family: \'Montserrat\', Arial, Helvetica, sans-serif; font-weight: 700">Hi</span>',
    );
  });

  it("expands a built-in font on a list item", async () => {
    const mjml = await render(
      '<ul><li style="font-family: Georgia">One</li></ul>',
    );
    expect(mjml).toContain('<li style="font-family: Georgia, serif">One</li>');
  });

  it("uses the configured default fallback for an unknown single family", async () => {
    const mjml = await render('<p style="font-family: Papyrus">Hi</p>', {
      defaultFallbackFont: "Georgia, serif",
    });
    expect(mjml).toContain(
      "<p style=\"font-family: 'Papyrus', Georgia, serif\">Hi</p>",
    );
  });

  it("uses the default fallback when a custom font has none", async () => {
    const mjml = await render('<p style="font-family: Montserrat">Hi</p>', {
      customFonts: [
        { name: "Montserrat", url: "https://fonts.example.com/montserrat.css" },
      ],
      defaultFallbackFont: "Georgia, serif",
    });
    expect(mjml).toContain(
      "<p style=\"font-family: 'Montserrat', Georgia, serif\">Hi</p>",
    );
  });

  it("keeps quoted fallback families valid in a double-quoted style attribute", async () => {
    const mjml = await render('<p style="font-family: Montserrat">Hi</p>', {
      customFonts: [
        {
          name: "Montserrat",
          url: "https://fonts.example.com/montserrat.css",
          fallback: '"Helvetica Neue", Arial, sans-serif',
        },
      ],
    });
    expect(mjml).toContain(
      "<p style=\"font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif\">Hi</p>",
    );
    const result = await mjml2html(mjml);
    expect(result.errors).toEqual([]);
  });

  it("leaves an existing stack and unrelated markup byte-identical", async () => {
    const content =
      '<p data-font="font-family: Montserrat" style="font-family: Montserrat, \'Trebuchet MS\', sans-serif; color: blue">Hi</p>';
    const mjml = await render(content);
    expect(mjml).toContain(content);
  });

  it("resolves HTML-escaped quotes in both style attribute quote forms", async () => {
    const mjml = await render(
      "<p><span style=\"font-family: &quot;Montserrat&quot;; color: red\">A</span><span style='font-family: &#39;Montserrat&#39;; color: blue'>B</span></p>",
    );
    expect(mjml).toContain(
      "<span style=\"font-family: 'Montserrat', Arial, Helvetica, sans-serif; color: red\">A</span>",
    );
    expect(mjml).toContain(
      "<span style='font-family: \"Montserrat\", Arial, Helvetica, sans-serif; color: blue'>B</span>",
    );
  });

  it("keeps an apostrophe in a custom font name inside a single-quoted attribute", async () => {
    const mjml = await render("<p style='font-family: Ma&#39;am Sans'>Hi</p>", {
      customFonts: [
        { name: "Ma'am Sans", url: "https://fonts.example.com/maam.css" },
      ],
    });
    expect(mjml).toContain(
      "<p style='font-family: \"Ma\\27 am Sans\", Arial, sans-serif'>Hi</p>",
    );
    const result = await mjml2html(mjml);
    expect(result.errors).toEqual([]);
  });

  it("resolves inline fonts in titles, including multiple paragraphs", async () => {
    const template = createDefaultTemplateContent();
    const mjml = await renderToMjml(
      {
        ...template,
        blocks: [
          createTitleBlock({
            content:
              '<p><span style="font-family: Montserrat">A</span></p><p style="font-family: Georgia">B</p>',
          }),
        ],
      },
      { customFonts },
    );
    expect(mjml).toContain(
      "<span style=\"font-family: 'Montserrat', Arial, Helvetica, sans-serif\">A</span>",
    );
    expect(mjml).toContain('<p style="font-family: Georgia, serif">B</p>');
  });

  it("keeps MSO conditional comments untouched", async () => {
    const comment =
      '<!--[if mso]><span style="font-family: Montserrat">Outlook</span><![endif]-->';
    const mjml = await render(
      `<p>${comment}<span style="font-family: Montserrat">Hi</span></p>`,
    );
    expect(mjml).toContain(comment);
    expect(mjml).toContain(
      "<span style=\"font-family: 'Montserrat', Arial, Helvetica, sans-serif\">Hi</span>",
    );
  });

  it("keeps the resolved custom stack in the compiled email HTML", async () => {
    const mjml = await render(
      '<p><span style="font-family: Montserrat">Hi</span></p>',
    );
    const result = await mjml2html(mjml);
    expect(result.errors).toEqual([]);
    expect(result.html).toContain(
      "font-family: 'Montserrat', Arial, Helvetica, sans-serif",
    );
    expect(result.html).not.toMatch(/font-family:\s*Montserrat\s*[;"']/);
  });
});
