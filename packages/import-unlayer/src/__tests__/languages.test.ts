import { describe, expect, it } from "vitest";
import { localeCoverage, resolveLocale, sourceHash } from "@templatical/types";
import { convertUnlayerTemplate } from "../index";
import { multilingual } from "./fixtures/multilingual";

function converted(
  source = multilingual,
  options?: { defaultLocale?: string },
) {
  const result = convertUnlayerTemplate(source, options);
  const section = result.content.blocks[0];
  if (section.type !== "section") throw new Error("Expected section");
  return { ...result, section, blocks: section.children[0] };
}
describe("Unlayer languages", () => {
  it.each([
    [0, "content", "<p>Hello</p>", "<p>Hola</p>"],
    [1, "content", "<p>Welcome</p>", "<p>Bienvenido</p>"],
    [2, "content", "<p>Title</p>", "<p>Título</p>"],
    [3, "text", "Shop", "Comprar"],
    [4, "alt", "Photo", "Foto"],
  ])(
    "maps block %s %s and normalizes underscores",
    (index, path, base, value) => {
      const { blocks, content } = converted();
      expect(blocks[Number(index)].l10n?.["es-ES"].text?.[path]).toEqual({
        value,
        sourceHash: sourceHash(String(base)),
      });
      expect(content.settings.locales).toEqual(["es-ES"]);
    },
  );
  it("maps image src as an override", () => {
    expect(converted().blocks[4].l10n?.["es-ES"].set).toEqual({
      src: "https://example.com/es.png",
    });
  });
  it("maps row background image through the existing image reader", () => {
    expect(
      converted().section.l10n?.["es-ES"].set?.backgroundImage,
    ).toMatchObject({ url: "https://example.com/es-bg.png" });
  });
  it("maps menu text to generated ids by position", () => {
    const menu = converted().blocks[5];
    if (menu.type !== "menu") throw new Error("Expected menu");
    expect(menu.l10n?.["es-ES"].text).toEqual({
      [`items.${menu.items[0].id}.text`]: {
        value: "Inicio",
        sourceHash: sourceHash("Home"),
      },
      [`items.${menu.items[1].id}.text`]: {
        value: "Nosotros",
        sourceHash: sourceHash("About"),
      },
    });
  });
  it("warns and skips a menu with different item counts", () => {
    const source = structuredClone(multilingual);
    source.body.rows[0].columns[0].contents[5].values._languages.es_ES.menu!.items.pop();
    const { blocks, report } = converted(source);
    expect(report.warnings.join(" ")).toMatch(/es-ES.*menu.*count/i);
    expect(blocks[5].l10n).toBeUndefined();
  });
  it("warns when en is assumed for a multilingual design", () => {
    const { content, report } = converted();
    expect(report.warnings.join(" ")).toMatch(/assumed.*"en"/i);
    expect(content.settings.locale).toBe("en");
  });
  it("uses defaultLocale instead of assuming en", () => {
    const { content, report } = converted(multilingual, {
      defaultLocale: "de",
    });
    expect(content.settings.locale).toBe("de");
    expect(report.warnings.join(" ")).not.toMatch(/assumed/);
  });
  it("warns about a device language and does not register it", () => {
    const source = structuredClone(multilingual) as any;
    source.body.rows[0].values._override = {
      mobile: {
        _languages: {
          fr_FR: { backgroundImage: { url: "https://example.com/fr.png" } },
        },
      },
    };
    const { content, report } = converted(source);
    expect(report.warnings.join(" ")).toMatch(/fr_FR.*device.*mobile/);
    expect(content.settings.locales).not.toContain("fr-FR");
  });
  it("drops an unsupported language with a warning", () => {
    const source = structuredClone(multilingual) as any;
    source.body.rows[0].columns[0].contents[0].values._languages["x-custom"] = {
      text: "Dropped",
    };
    expect(converted(source).report.warnings.join(" ")).toMatch(
      /x-custom.*unsupported language tag/,
    );
  });
  it("warns when a translated element becomes an HTML fallback", () => {
    const source = structuredClone(multilingual);
    source.body.rows[0].columns[0].contents[0].type = "unknown";
    const { blocks, report } = converted(source);
    expect(report.warnings.join(" ")).toMatch(/es-ES.*HTML fallback/);
    expect(blocks[0].l10n).toBeUndefined();
  });
  it("warns when a body language has no mapping", () => {
    const source = structuredClone(multilingual) as any;
    source.body.values._languages = { it_IT: { preheaderText: "Anteprima" } };
    const { content, report } = converted(source);
    expect(report.warnings.join(" ")).toMatch(
      /it_IT.*no language mapping for this format/,
    );
    expect(content.settings.locales).not.toContain("it-IT");
  });
  it("inherits background image settings in a URL-only language override", () => {
    const source = structuredClone(multilingual) as any;
    const row = source.body.rows[0];
    row.values.columnsBackgroundColor = "#ffffff";
    Object.assign(row.values.backgroundImage, {
      size: "contain",
      position: "bottom-right",
      repeat: "repeat",
    });
    row.values._languages.es_ES.backgroundImage = {
      url: "https://example.com/es-only.png",
    };
    const { content, section, report } = converted(source);
    expect(section.backgroundImage).toEqual({
      url: "https://example.com/en-bg.png",
      size: "contain",
      position: { x: "right", y: "bottom" },
      repeat: true,
    });
    expect(section.l10n?.["es-ES"].set?.backgroundImage).toEqual({
      url: "https://example.com/es-only.png",
      size: "contain",
      position: { x: "right", y: "bottom" },
      repeat: true,
    });
    expect(resolveLocale(content, "es-ES").blocks[0]).toHaveProperty(
      "backgroundImage.url",
      "https://example.com/es-only.png",
    );
    expect(report.warnings.join(" ")).not.toContain(
      "section keeps the content background",
    );
  });

  it("removes a background image only in the language with an empty URL", () => {
    const source = structuredClone(multilingual);
    source.body.rows[0].values._languages.es_ES.backgroundImage.url = "";
    const { content, section } = converted(source);
    expect(section.l10n?.["es-ES"].set?.backgroundImage).toBeNull();
    expect(
      resolveLocale(content, content.settings.locale).blocks[0],
    ).toHaveProperty("backgroundImage.url", "https://example.com/en-bg.png");
    expect(resolveLocale(content, "es-ES").blocks[0]).not.toHaveProperty(
      "backgroundImage",
    );
  });

  it.each(["text", "paragraph", "heading"])(
    "leaves unreadable translated %s missing instead of stamping default text",
    (type) => {
      const source = structuredClone(multilingual) as any;
      source.body.rows[0].columns[0].contents[0] = {
        type,
        values: {
          text: type === "heading" ? "Hello" : "<p>Hello</p>",
          _languages: { es_ES: { textJson: "{bad" } },
        },
      };
      const { content, blocks, report } = converted(source);
      const field = `${blocks[0].id}/content`;
      expect(blocks[0].l10n?.["es-ES"]?.text?.content).toBeUndefined();
      expect(localeCoverage(content, "es-ES").missing).toContain(field);
      expect(localeCoverage(content, "es-ES").translated).not.toContain(field);
      expect(JSON.stringify(resolveLocale(content, "es-ES").blocks)).toContain(
        "<p>Hello</p>",
      );
      expect(report.warnings.join(" ")).toMatch(/es-ES.*unreadable.*text/i);

      source.body.rows[0].columns[0].contents[0].values._languages.es_ES.text =
        type === "heading" ? "Hola" : "<p>Hola</p>";
      const fallback = converted(source);
      expect(fallback.blocks[0].l10n?.["es-ES"].text?.content).toEqual({
        value: "<p>Hola</p>",
        sourceHash: sourceHash("<p>Hello</p>"),
      });
      expect(localeCoverage(fallback.content, "es-ES").translated).toContain(
        `${fallback.blocks[0].id}/content`,
      );
      expect(fallback.report.warnings.join(" ")).not.toMatch(
        /unreadable.*text/i,
      );
    },
  );

  it("keeps translated menu text and warns once about discarded links", () => {
    const source = structuredClone(multilingual) as any;
    const values = source.body.rows[0].columns[0].contents[5].values;
    for (const [index, item] of values._languages.es_ES.menu.items.entries()) {
      values.menu.items[index].link = {
        values: { href: `https://example.com/en/${index}` },
      };
      item.link = { values: { href: `https://example.com/es/${index}` } };
    }
    const { content, blocks, report } = converted(source);
    const menu = blocks[5];
    if (menu.type !== "menu") throw new Error("Expected menu");
    expect(
      menu.l10n?.["es-ES"].text?.[`items.${menu.items[0].id}.text`],
    ).toEqual({ value: "Inicio", sourceHash: sourceHash("Home") });
    expect(
      report.warnings.filter(
        (warning) => warning.includes("es-ES") && warning.includes('"link"'),
      ),
    ).toHaveLength(1);
    const section = resolveLocale(content, "es-ES").blocks[0];
    if (section.type !== "section") throw new Error("Expected section");
    const projected = section.children[0][5];
    if (projected.type !== "menu") throw new Error("Expected menu");
    expect(projected.items.map((item) => [item.text, item.url])).toEqual([
      ["Inicio", "https://example.com/en/0"],
      ["Nosotros", "https://example.com/en/1"],
    ]);
  });
  it("keeps coverage missing when the only language field is unreadable", () => {
    const { content, report } = convertUnlayerTemplate({
      body: {
        values: {},
        rows: [
          {
            cells: [1],
            values: {},
            columns: [
              {
                values: {},
                contents: [
                  {
                    type: "text",
                    values: {
                      text: "<p>Hello</p>",
                      _languages: { es_ES: { textJson: "{bad" } },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(content.settings.locales).toEqual(["es-ES"]);
    const section = content.blocks[0];
    if (section.type !== "section") throw new Error("Expected section");
    expect(localeCoverage(content, "es-ES")).toEqual({
      translated: [],
      missing: [`${section.children[0][0].id}/content`],
      stale: [],
    });
    expect(section.children[0][0].l10n).toBeUndefined();
    expect(report.warnings.join(" ")).toMatch(/es-ES.*unreadable.*text/i);
  });
  it.each([
    { name: "numeric", url: 42 },
    { name: "object", url: { href: "https://example.com/es-bg.png" } },
  ])(
    "preserves the default image when the translated background URL is $name",
    ({ url }) => {
      const source = structuredClone(multilingual) as any;
      source.body.rows[0].values._languages.es_ES.backgroundImage.url = url;
      const { content, section, report } = converted(source);
      expect(section.backgroundImage).toHaveProperty(
        "url",
        "https://example.com/en-bg.png",
      );
      expect(section.l10n?.["es-ES"]?.set?.backgroundImage).toBeUndefined();
      for (const locale of [content.settings.locale, "es-ES"]) {
        expect(resolveLocale(content, locale).blocks[0]).toHaveProperty(
          "backgroundImage",
          {
            url: "https://example.com/en-bg.png",
            size: "auto",
            position: { x: "center", y: "center" },
            repeat: false,
          },
        );
      }
      expect(
        report.warnings.filter(
          (warning) =>
            warning.includes("es-ES") &&
            warning.includes('"backgroundImage.url"'),
        ),
      ).toEqual([
        'Dropped language "es-ES" key "backgroundImage.url": unreadable translated URL.',
      ]);
    },
  );
});
