import { describe, expect, it, vi } from "vitest";
import {
  createDefaultTemplateContent,
  createCustomBlock,
  createImageBlock,
  createParagraphBlock,
  createSlotBlock,
  sourceHash,
} from "@templatical/types";
import { renderToMjml } from "../src";

function localizedContent() {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = [
    createParagraphBlock({
      content: "Hello",
      l10n: {
        de: {
          text: { content: { value: "Hallo", source: sourceHash("Hello") } },
        },
      },
    }),
    createImageBlock({
      src: "https://example.com/en.png",
      alt: "Hero",
      l10n: { de: { set: { src: "https://example.com/de.png" } } },
    }),
    createParagraphBlock({
      content: "US only",
      l10n: { de: { hidden: true } },
    }),
  ];
  return content;
}

describe("locale rendering", () => {
  it.each(["text", "set"] as const)(
    "omits a custom block with a %s layer without a resolver and renders its translated fields with one",
    async (kind) => {
      const custom = createCustomBlock({
        type: "promo",
        name: "Promo",
        template: "",
        fields: [],
      });
      custom.fieldValues = { headline: "Welcome" };
      custom.renderedHtml = "<p>Welcome</p>";
      custom.renderedStylesheet = ".promo { color: red; }";
      custom.l10n = {
        de:
          kind === "text"
            ? {
                text: {
                  "fieldValues.headline": {
                    value: "Willkommen",
                    source: sourceHash("Welcome"),
                  },
                },
              }
            : { set: { "fieldValues.headline": "Willkommen" } },
      };
      const content = localizedContent();
      content.blocks = [custom];
      const before = JSON.stringify(content);
      const withoutResolver = await renderToMjml(content, { locale: "de" });
      expect(withoutResolver).not.toContain("Welcome");
      expect(withoutResolver).not.toContain("Willkommen");
      const renderCustomBlock = vi.fn(async (block: typeof custom) => {
        expect(block).not.toHaveProperty("renderedHtml");
        return `<p>${block.fieldValues.headline}</p>`;
      });
      const withResolver = await renderToMjml(content, {
        locale: "de",
        renderCustomBlock,
      });
      expect(renderCustomBlock).toHaveBeenCalledOnce();
      expect(withResolver).toContain("<p>Willkommen</p>");
      expect(withResolver).not.toContain("Welcome");
      expect(withResolver).toContain(custom.renderedStylesheet);
      expect(await renderToMjml(content)).toContain("<p>Welcome</p>");
      expect(JSON.stringify(content)).toBe(before);
    },
  );

  it("renders translated text and image, omits hidden blocks, and stamps the language", async () => {
    const content = localizedContent();
    const before = JSON.stringify(content);
    const mjml = await renderToMjml(content, { locale: "de" });
    expect(mjml).toContain("Hallo");
    expect(mjml).toContain('src="https://example.com/de.png"');
    expect(mjml).not.toContain("US only");
    expect(mjml).not.toContain("Hello");
    expect(mjml).toContain('<mjml lang="de" dir="ltr">');
    expect(JSON.stringify(content)).toBe(before);
  });

  it("uses the version's direction", async () => {
    const content = localizedContent();
    content.settings.l10n = { de: { set: { direction: "rtl" } } };
    expect(await renderToMjml(content, { locale: "de" })).toContain(
      '<mjml lang="de" dir="rtl">',
    );
  });

  it("preserves the current single-language output and rejects unknown locales", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({ id: "baseline", content: "Existing email" }),
    ];
    expect(await renderToMjml(content)).toMatchSnapshot();
    await expect(renderToMjml(content, { locale: "xx" })).rejects.toMatchObject(
      { code: "unknown_locale" },
    );
  });

  it("localizes the campaign before applying an unlocalized layout", async () => {
    const layout = createDefaultTemplateContent();
    layout.blocks = [
      createParagraphBlock({ content: "Layout footer" }),
      createSlotBlock(),
    ];
    const mjml = await renderToMjml(localizedContent(), {
      locale: "de",
      layout,
    });
    expect(mjml).toContain("Hallo");
    expect(mjml).toContain("Layout footer");
    expect(mjml).toContain('<mjml lang="de"');
  });
});
