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

  it("keeps !important on a resolved inline font", async () => {
    const mjml = await render(
      '<p style="font-family: Montserrat !important; color: red">Hi</p>',
    );
    expect(mjml).toContain(
      "<p style=\"font-family: 'Montserrat', Arial, Helvetica, sans-serif !important; color: red\">Hi</p>",
    );
  });

  it.each(["&#59;", "&#x3b;", "&semi;"])(
    "splits declarations at an encoded %s separator",
    async (separator) => {
      const mjml = await render(
        `<p style="font-family: Montserrat${separator} color: red">Hi</p>`,
      );
      expect(mjml).toContain(
        `<p style="font-family: 'Montserrat', Arial, Helvetica, sans-serif; color: red">Hi</p>`,
      );
      const compiled = await mjml2html(mjml);
      expect(compiled.errors).toEqual([]);
      expect(compiled.html).toContain("color: red");
    },
  );

  it("resolves a hex escape inside a quoted font family", async () => {
    const mjml = await render(
      `<p style="font-family: 'M\\6f ntserrat'; color: red">Hi</p>`,
    );
    expect(mjml).toContain(
      `<p style="font-family: 'Montserrat', Arial, Helvetica, sans-serif; color: red">Hi</p>`,
    );
  });

  it("keeps a double quote in a configured font inside a double-quoted style attribute", async () => {
    const mjml = await render(
      '<p style="font-family: Rock &quot;n&quot; Roll; color: red">Hi</p>',
      {
        customFonts: [
          {
            name: 'Rock "n" Roll',
            url: "https://fonts.example.com/rock.css",
            fallback: "Arial, sans-serif",
          },
        ],
      },
    );
    expect(mjml).toContain(
      "<p style=\"font-family: 'Rock \\22 n\\22  Roll', Arial, sans-serif; color: red\">Hi</p>",
    );
    const result = await mjml2html(mjml);
    expect(result.errors).toEqual([]);
    expect(result.html).toContain("Rock \\22 n\\22  Roll");
    expect(result.html).toContain("color: red");
  });

  it.each([
    ["&quot;", "&quot;"],
    ["&#34;", "&#34;"],
    ["&#x22;", "&#x22;"],
    ["&apos;", "&apos;"],
    ["&#39;", "&#39;"],
    ["&#x27;", "&#x27;"],
  ])(
    "keeps a semicolon inside a family quoted with %s",
    async (open, close) => {
      const mjml = await render(
        `<p style="font-family: ${open}Acme; Display${close}; color: red">Hi</p>`,
        {
          customFonts: [
            {
              name: "Acme; Display",
              url: "https://fonts.example.com/acme.css",
              fallback: "Arial, sans-serif",
            },
          ],
        },
      );
      expect(mjml).toContain(
        "<p style=\"font-family: 'Acme; Display', Arial, sans-serif; color: red\">Hi</p>",
      );
    },
  );

  it("keeps a semicolon inside a CSS function before the font declaration", async () => {
    const mjml = await render(
      '<p style="background-image: url(data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E); font-family: Montserrat">Hi</p>',
    );
    expect(mjml).toContain(
      "<p style=\"background-image: url(data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E); font-family: 'Montserrat', Arial, Helvetica, sans-serif\">Hi</p>",
    );
  });

  it("keeps an escaped encoded quote inside a URL from hiding the font declaration", async () => {
    const mjml = await render(
      '<p style="background-image: url(icon\\&quot;.svg); font-family: Montserrat">Hi</p>',
    );
    expect(mjml).toContain(
      "<p style=\"background-image: url(icon\\22 .svg); font-family: 'Montserrat', Arial, Helvetica, sans-serif\">Hi</p>",
    );
  });

  it("treats an encoded backslash before an encoded quote as a CSS escape", async () => {
    const mjml = await render(
      '<p style="background-image: url(icon&#92;&apos;.svg); font-family: Montserrat">Hi</p>',
    );
    expect(mjml).toContain(
      "<p style=\"background-image: url(icon\\'.svg); font-family: 'Montserrat', Arial, Helvetica, sans-serif\">Hi</p>",
    );
  });

  it("preserves an encoded escaped apostrophe in a single-quoted style attribute", async () => {
    const mjml = await render(
      "<p style='background-image: url(icon&#92;&apos;.svg); font-family: Montserrat'>Hi</p>",
    );
    expect(mjml).toContain(
      "<p style='background-image: url(icon\\27 .svg); font-family: \"Montserrat\", Arial, Helvetica, sans-serif'>Hi</p>",
    );
  });

  it("ignores encoded quotes inside CSS comments before a font declaration", async () => {
    const mjml = await render(
      '<p style="color: red /* &quot; */; font-family: Montserrat">Hi</p>',
    );
    expect(mjml).toContain(
      "<p style=\"color: red /* ' */; font-family: 'Montserrat', Arial, Helvetica, sans-serif\">Hi</p>",
    );
  });

  it("recognizes a CSS comment closed by an encoded slash", async () => {
    const mjml = await render(
      '<p style="color: red /* note *&#47;; font-family: Montserrat">Hi</p>',
    );
    expect(mjml).toContain(
      "<p style=\"color: red /* note */; font-family: 'Montserrat', Arial, Helvetica, sans-serif\">Hi</p>",
    );
  });

  it("does not read a slash-star sequence inside a URL as a CSS comment", async () => {
    const mjml = await render(
      '<p style="background-image: url(https://cdn.example.com/*logo.svg); font-family: Montserrat">Hi</p>',
    );
    expect(mjml).toContain(
      "<p style=\"background-image: url(https://cdn.example.com/*logo.svg); font-family: 'Montserrat', Arial, Helvetica, sans-serif\">Hi</p>",
    );
  });

  it("keeps a slash-star sequence inside a URL with an encoded function name", async () => {
    const mjml = await render(
      '<p style="background-image: u&#114;l(https://cdn.example.com/*logo.svg); font-family: Montserrat">Hi</p>',
    );
    expect(mjml).toContain(
      "<p style=\"background-image: url(https://cdn.example.com/*logo.svg); font-family: 'Montserrat', Arial, Helvetica, sans-serif\">Hi</p>",
    );
  });

  it.each(["Acme\\; Display", "Acme\\3b  Display"])(
    "matches %s as an escaped custom font name",
    async (family) => {
      const mjml = await render(`<p style="font-family: ${family}">Hi</p>`, {
        customFonts: [
          {
            name: "Acme; Display",
            url: "https://fonts.example.com/acme.css",
            fallback: "Helvetica, sans-serif",
          },
        ],
        defaultFallbackFont: "Arial, sans-serif",
      });
      expect(mjml).toContain(
        "<p style=\"font-family: 'Acme; Display', Helvetica, sans-serif\">Hi</p>",
      );
    },
  );

  it("uses the CSS replacement character for an out-of-range font escape", async () => {
    const mjml = await render(
      '<p style="font-family: Bad\\110000 Font">Hi</p>',
    );
    expect(mjml).toContain(
      "<p style=\"font-family: 'Bad�Font', Arial, sans-serif\">Hi</p>",
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

  it("carries a single title paragraph's font onto the compiled heading", async () => {
    const template = createDefaultTemplateContent();
    const mjml = await renderToMjml(
      {
        ...template,
        blocks: [
          createTitleBlock({
            content: '<p style="font-family: Montserrat; color: red">Hi</p>',
          }),
        ],
      },
      { customFonts },
    );
    expect(mjml).toContain(
      `style="margin:0;font-size:inherit;color:inherit;line-height:inherit;font-weight:700;`,
    );
    const compiled = await mjml2html(mjml);
    expect(compiled.errors).toEqual([]);
    expect(compiled.html).toMatch(
      /<h2[^>]*style="[^"]*font-family: 'Montserrat', Arial, Helvetica, sans-serif/,
    );
  });

  it("keeps an important title font ahead of a later normal declaration", async () => {
    const template = createDefaultTemplateContent();
    const mjml = await renderToMjml(
      {
        ...template,
        blocks: [
          createTitleBlock({
            content:
              '<p style="font-family: Georgia !important; font-family: Montserrat">Hi</p>',
          }),
        ],
      },
      { customFonts },
    );
    const compiled = await mjml2html(mjml);
    expect(compiled.errors).toEqual([]);
    expect(compiled.html).toMatch(
      /<h2[^>]*font-family: Georgia, serif !important/,
    );
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
