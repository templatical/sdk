import { describe, expect, it } from "vitest";
import { sourceHash } from "@templatical/types";
import { convertTopolTemplate } from "../index";
import { multilingual } from "./fixtures/multilingual";

function converted(
  source = multilingual,
  options?: { defaultLocale?: string },
) {
  const result = convertTopolTemplate(source, options);
  const section = result.content.blocks[0];
  if (section.type !== "section") throw new Error("Expected section");
  return { ...result, blocks: section.children[0] };
}
describe("Topol languages", () => {
  it("uses the primary entry before defaultLocale", () => {
    const source = structuredClone(multilingual);
    source.langs.reverse();
    expect(
      converted(source, { defaultLocale: "fr" }).content.settings.locale,
    ).toBe("en-US");
  });
  it("uses the first entry without a primary", () => {
    const source = structuredClone(multilingual);
    source.langs[0].primary = false;
    source.langs.reverse();
    expect(converted(source).content.settings.locale).toBe("de");
  });
  it("uses defaultLocale without source languages", () => {
    expect(
      convertTopolTemplate(
        { tagName: "mj-global-style" },
        { defaultLocale: "de" },
      ).content.settings.locale,
    ).toBe("de");
  });
  it.each([
    [0, "content", "Hello", "Hallo"],
    [1, "content", "<p>Welcome</p>", "<p>Willkommen</p>"],
    [2, "text", "Shop", "Kaufen"],
    [3, "alt", "Photo", "Foto"],
  ])(
    "maps uid for block %s %s with the imported source hash",
    (index, path, base, value) => {
      const { blocks, content } = converted();
      expect(blocks[Number(index)].l10n?.de.text?.[path]).toEqual({
        value,
        sourceHash: sourceHash(String(base)),
      });
      expect(content.settings.locales).toEqual(["de"]);
      expect(blocks[Number(index)].id).not.toBe(
        ["heading", "paragraph", "button", "image"][Number(index)],
      );
    },
  );
  it("maps href and src overrides", () => {
    const { blocks } = converted();
    expect(blocks[2].l10n?.de.set).toEqual({ url: "https://example.com/de" });
    expect(blocks[3].l10n?.de.set).toEqual({
      src: "https://example.com/de.png",
      linkUrl: "https://example.com/de",
    });
  });
  it("maps default and translated preview text", () => {
    const { content } = converted();
    expect(content.settings.preheaderText).toBe("News");
    expect(content.settings.l10n?.de.text?.preheaderText).toEqual({
      value: "Neuigkeiten",
      sourceHash: sourceHash("News"),
    });
  });
  it("warns about mj-subject", () => {
    const source = structuredClone(multilingual) as any;
    source.langs[1].translations["mj-subject"] = { content: "Subject" };
    expect(converted(source).report.warnings.join(" ")).toMatch(
      /de.*mj-subject/,
    );
  });
  it.each(["empty", "fallback"])(
    "warns about the untranslated %s uid",
    (uid) => {
      const source = structuredClone(multilingual) as any;
      source.langs[1].translations[uid] = { content: "Dropped" };
      expect(converted(source).report.warnings.join(" ")).toMatch(
        new RegExp(`de.*${uid}.*(null|HTML fallback)`),
      );
    },
  );
  it("normalizes underscores and drops unsupported language tags", () => {
    const source = structuredClone(multilingual) as any;
    source.langs[1].key = "es_ES";
    source.langs.push(
      { key: "custom-code", translations: {} },
      { key: "x-custom", translations: {} },
    );
    const { content, report } = converted(source);
    expect(content.settings.locales).toEqual(["es-ES"]);
    expect(report.warnings.join(" ")).toMatch(
      /custom-code.*unsupported language tag/,
    );
    expect(report.warnings.join(" ")).toMatch(
      /x-custom.*unsupported language tag/,
    );
  });
  it("keeps a declared version with no translated fields", () => {
    const source = structuredClone(multilingual);
    source.langs[1].translations = {};
    expect(converted(source).content.settings.locales).toEqual(["de"]);
  });
});
