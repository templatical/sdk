import { describe, expect, it } from "vitest";
import { sourceHash } from "@templatical/types";
import { convertBeeFreeTemplate } from "../index";
import { multilingual } from "./fixtures/multilingual";

describe("BeeFree languages", () => {
  it.each([
    [0, "content", "<p>Hello</p>", "<p>Hola</p>"],
    [1, "content", "<p>Welcome</p>", "<p>Bienvenido</p>"],
    [2, "content", "<ul><li>One</li></ul>", "<ul><li>Uno</li></ul>"],
    [3, "text", "Shop", "Comprar"],
    [4, "alt", "Photo", "Foto"],
    [5, "alt", "Preview", "Vista previa"],
  ])(
    "maps block %s %s with the imported source hash",
    (index, path, base, value) => {
      const { content } = convertBeeFreeTemplate(multilingual);
      expect(
        content.blocks[Number(index)].l10n?.["es-ES"].text?.[path],
      ).toEqual({ value, sourceHash: sourceHash(String(base)) });
    },
  );
  it("maps menu text by position to generated item ids", () => {
    const { content } = convertBeeFreeTemplate(multilingual);
    const menu = content.blocks[6];
    expect(menu.type).toBe("menu");
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
  it("maps the preheader and registers the version", () => {
    const { content } = convertBeeFreeTemplate(multilingual);
    expect(content.settings.locales).toEqual(["es-ES"]);
    expect(content.settings.preheaderText).toBe("News");
    expect(content.settings.l10n?.["es-ES"].text?.preheaderText).toEqual({
      value: "Noticias",
      sourceHash: sourceHash("News"),
    });
  });
  it.each(["body", "page", "root"])(
    "reads the %s language location before defaultLocale",
    (location) => {
      const source = structuredClone(multilingual) as any;
      delete source.page.body.language;
      const owner =
        location === "body"
          ? source.page.body
          : location === "page"
            ? source.page
            : source;
      owner.language = { value: "en_US" };
      expect(
        convertBeeFreeTemplate(source, { defaultLocale: "de" }).content.settings
          .locale,
      ).toBe("en-US");
    },
  );
  it("uses defaultLocale when there is no declared language", () => {
    expect(
      convertBeeFreeTemplate({ page: { rows: [] } }, { defaultLocale: "de" })
        .content.settings.locale,
    ).toBe("de");
  });
  it("warns and skips a menu with different item counts", () => {
    const source = structuredClone(multilingual);
    source.page.rows[0].columns[0].modules[6].descriptor.menu!.translations[
      "es-ES"
    ].items.pop();
    const { content, report } = convertBeeFreeTemplate(source);
    expect(report.warnings.join(" ")).toMatch(/es-ES.*menu.*count/i);
    expect(content.blocks[6].l10n).toBeUndefined();
  });
  it.each(["subject", "title", "description"])(
    "warns about host-owned %s",
    (key) => {
      const source = structuredClone(multilingual) as any;
      source.head.meta.translations["es-ES"][key] = "Translated metadata";
      const { report } = convertBeeFreeTemplate(source);
      expect(report.warnings.join(" ")).toMatch(new RegExp(`es-ES.*${key}`));
    },
  );
  it("warns once per unknown key and language across modules", () => {
    const source = structuredClone(multilingual) as any;
    for (const module of source.page.rows[0].columns[0].modules.slice(0, 2)) {
      Object.values(module.descriptor).forEach((value: any) => {
        value.translations["es-ES"].url = "https://example.com/es";
      });
    }
    const { report } = convertBeeFreeTemplate(source);
    expect(
      report.warnings.filter((w) => w.includes("es-ES") && w.includes('"url"')),
    ).toHaveLength(1);
  });
  it("drops an unsupported language tag with one warning", () => {
    const source = structuredClone(multilingual) as any;
    source.page.rows[0].columns[0].modules[0].descriptor.heading.translations[
      "x-custom"
    ] = { text: "Dropped" };
    const { content, report } = convertBeeFreeTemplate(source);
    expect(
      report.warnings.filter(
        (w) => w.includes("x-custom") && w.includes("unsupported language tag"),
      ),
    ).toHaveLength(1);
    expect(content.settings.locales).not.toContain("x-custom");
  });
  it("warns when a translated module becomes an HTML fallback", () => {
    const source = structuredClone(multilingual) as any;
    source.page.rows[0].columns[0].modules[0].type = "unknown";
    const { content, report } = convertBeeFreeTemplate(source);
    expect(report.warnings.join(" ")).toMatch(/es-ES.*HTML fallback/);
    expect(content.blocks[0].l10n).toBeUndefined();
  });
  it("warns about an unmapped URL inside a translated menu item", () => {
    const source = structuredClone(multilingual) as any;
    source.page.rows[0].columns[0].modules[6].descriptor.menu.translations[
      "es-ES"
    ].items[0].url = "https://example.com/es";
    const { report } = convertBeeFreeTemplate(source);
    expect(
      report.warnings.filter((w) => w.includes("es-ES") && w.includes('"url"')),
    ).toHaveLength(1);
  });
});
