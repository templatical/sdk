import { describe, expect, it } from "vitest";
import {
  cloneBlock,
  createCustomBlock,
  createTableBlock,
  isLocaleTag,
  localeCoverage,
  localizeBlock,
  readPath,
  resolveLocale,
  SdkError,
  sourceHash,
  translatableFields,
  type TemplateContent,
} from "../src";

const base = (): TemplateContent =>
  ({
    blocks: [
      {
        id: "t1",
        type: "title",
        content: "<p>Spring sale</p>",
        level: 1,
        styles: {},
        l10n: {
          de: {
            text: {
              content: {
                value: "<p>Frühlingsangebot</p>",
                source: sourceHash("<p>Spring sale</p>"),
              },
            },
          },
        },
      },
      {
        id: "img",
        type: "image",
        src: "https://media.example.com/hero-en.png",
        alt: "Hero",
        styles: {},
        l10n: { de: { set: { src: "https://media.example.com/hero-de.png" } } },
      },
      {
        id: "s1",
        type: "section",
        columns: "1",
        styles: {},
        children: [
          [
            {
              id: "us",
              type: "paragraph",
              content: "<p>US only</p>",
              styles: {},
              l10n: { de: { hidden: true } },
            },
            {
              id: "m1",
              type: "menu",
              items: [
                { id: "i1", text: "Shop", url: "https://example.com/shop" },
              ],
              styles: {},
              l10n: {
                de: {
                  text: {
                    "items.i1.text": { value: "Laden", source: "00000000" },
                  },
                },
              },
            },
          ],
        ],
      },
    ],
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      fontFamily: "Arial",
      linkUnderline: true,
      locale: "en",
      preheaderText: "Save now",
      locales: ["de"],
      l10n: {
        de: {
          text: {
            preheaderText: {
              value: "Jetzt sparen",
              source: sourceHash("Save now"),
            },
          },
        },
      },
    },
  }) as unknown as TemplateContent;

describe("isLocaleTag", () => {
  it.each([
    "en",
    "DE",
    "pt-BR",
    "zh-Hant-TW",
    "abc-12",
    "en-a1",
    "en-12345678",
  ])("accepts the LOC1 tag %s", (tag) => expect(isLocaleTag(tag)).toBe(true));

  it.each([
    "",
    "x-acme",
    "i-klingon",
    "abcd",
    "e",
    "en-a",
    "en-123456789",
    "en_US",
    "en-",
    null,
    undefined,
    42,
    ["en"],
    {},
  ])("refuses a value outside the LOC1 tag rule: %j", (value) =>
    expect(isLocaleTag(value)).toBe(false),
  );
});

describe("sourceHash", () => {
  it("is FNV-1a 32-bit over UTF-8, as 8 hex digits", () => {
    expect(sourceHash("")).toBe("811c9dc5");
    expect(sourceHash("a")).toBe("e40c292c");
    expect(sourceHash("foobar")).toBe("bf9cf968");
    expect(sourceHash("ü")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("readPath and translatableFields", () => {
  it("addresses list elements by id", () => {
    const content = base();
    const menu = (content.blocks[2] as any).children[0][1];
    expect(readPath(menu, "items.i1.text")).toBe("Shop");
    expect(readPath(menu, "items.missing.text")).toBeUndefined();
  });

  it("lists a block's translatable paths, expanding element ids", () => {
    const content = base();
    expect(translatableFields(content.blocks[0])).toEqual(["content"]);
    expect(translatableFields(content.blocks[1])).toEqual(["alt"]);
    expect(
      translatableFields((content.blocks[2] as any).children[0][1]),
    ).toEqual(["items.i1.text"]);
    expect(translatableFields(content.blocks[2])).toEqual([]);
  });

  it("asks the custom block's definition which fieldValues are text", () => {
    const block = {
      id: "c1",
      type: "custom",
      customType: "promo",
      fieldValues: { headline: "Hi", color: "#000" },
      styles: {},
    } as any;
    const definitions = [
      {
        type: "promo",
        fields: [
          { key: "headline", type: "text" },
          { key: "color", type: "color" },
        ],
      },
    ] as any;
    expect(translatableFields(block, definitions)).toEqual([
      "fieldValues.headline",
    ]);
    expect(translatableFields(block)).toEqual([]);
  });
});

describe("list elements whose ids contain dots", () => {
  it("omits menu text from fields and coverage and renders its base text", () => {
    const content = base();
    const menu = (content.blocks[2] as any).children[0][1];
    menu.items[0].id = "shop.link";
    menu.l10n.de.text = {
      "items.shop.link.text": { value: "Laden", source: sourceHash("Shop") },
    };
    content.blocks = [menu];
    expect(translatableFields(menu)).toEqual([]);
    expect(localeCoverage(content, "de")).toEqual({
      translated: ["settings/preheaderText"],
      missing: [],
      stale: [],
    });
    expect((resolveLocale(content, "de").blocks[0] as any).items[0].text).toBe(
      "Shop",
    );
  });

  it("skips dotted table row and cell ids while keeping localizable cells", () => {
    const table = {
      id: "table",
      type: "table",
      styles: {},
      rows: [
        { id: "bad.row", cells: [{ id: "c1", content: "Row" }] },
        {
          id: "r2",
          cells: [
            { id: "bad.cell", content: "Cell" },
            { id: "c2", content: "Keep" },
          ],
        },
      ],
    } as any;
    expect(translatableFields(table)).toEqual(["rows.r2.cells.c2.content"]);
  });
});

describe("localizeBlock and resolveLocale", () => {
  it.each(["text", "set"] as const)(
    "drops a custom block's default pre-render for a %s layer, preserving styles and fallback versions",
    (kind) => {
      const block = createCustomBlock({
        type: "promo",
        name: "Promo",
        template: "",
        fields: [],
      });
      block.fieldValues = { headline: "Welcome" };
      block.renderedHtml = "<p>Welcome</p>";
      block.renderedStylesheet = ".promo { color: red; }";
      block.l10n = {
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
      const content = base();
      content.blocks = [block];
      content.settings.locales = ["de", "fr"];
      const before = JSON.stringify(content);
      const view = localizeBlock(block, "de", "en");
      expect(view).not.toHaveProperty("renderedHtml");
      expect(view).toMatchObject({
        fieldValues: { headline: "Willkommen" },
        renderedStylesheet: block.renderedStylesheet,
      });
      expect(resolveLocale(content, "de").blocks[0]).not.toHaveProperty(
        "renderedHtml",
      );
      expect(localizeBlock(block, "en", "en")).toHaveProperty(
        "renderedHtml",
        "<p>Welcome</p>",
      );
      expect(localizeBlock(block, "fr", "en")).toHaveProperty(
        "renderedHtml",
        "<p>Welcome</p>",
      );
      expect(
        localizeBlock({ ...block, l10n: { de: { hidden: true } } }, "de", "en"),
      ).toHaveProperty("renderedHtml", "<p>Welcome</p>");
      expect(JSON.stringify(content)).toBe(before);
    },
  );

  it("applies text, set and settings, drops hidden blocks, and strips localization fields", () => {
    const projected = resolveLocale(base(), "de");
    expect((projected.blocks[0] as any).content).toBe(
      "<p>Frühlingsangebot</p>",
    );
    expect((projected.blocks[1] as any).src).toBe(
      "https://media.example.com/hero-de.png",
    );
    expect((projected.blocks[1] as any).alt).toBe("Hero"); // missing → default (LD3)
    const column = (projected.blocks[2] as any).children[0];
    expect(column.map((b: any) => b.id)).toEqual(["m1"]);
    expect(column[0].items[0].text).toBe("Laden");
    expect(projected.settings.preheaderText).toBe("Jetzt sparen");
    expect(projected.settings.locale).toBe("de");
    expect(JSON.stringify(projected)).not.toMatch(/"l10n"|"locales"/);
  });

  it("returns the default language with localization fields removed", () => {
    const projected = resolveLocale(base(), "en");
    expect((projected.blocks[0] as any).content).toBe("<p>Spring sale</p>");
    expect(projected.settings.locale).toBe("en");
    expect(JSON.stringify(projected)).not.toMatch(/"l10n"|"locales"/);
  });

  it("leaves a template without localization untouched and does not mutate its input", () => {
    const plain = base();
    delete (plain.settings as any).locales;
    delete (plain.settings as any).l10n;
    const strip = (blocks: any[]) => {
      for (const b of blocks) {
        delete b.l10n;
        if (b.type === "section")
          for (const column of b.children) strip(column);
      }
    };
    strip(plain.blocks);
    const before = JSON.stringify(plain);
    expect(resolveLocale(plain, "en")).toEqual(JSON.parse(before));
    expect(JSON.stringify(plain)).toBe(before);
  });

  it("throws unknown_locale for a language the template doesn't have", () => {
    expect(() => resolveLocale(base(), "fr")).toThrowError(SdkError);
    try {
      resolveLocale(base(), "fr");
    } catch (error) {
      expect((error as SdkError).code).toBe("unknown_locale");
    }
  });

  it("localizes one block without touching children", () => {
    const content = base();
    const view = localizeBlock(content.blocks[0], "de", "en");
    expect((view as any).content).toBe("<p>Frühlingsangebot</p>");
    expect((view as any).l10n).toBeUndefined();
    expect(localizeBlock(content.blocks[0], "en", "en")).not.toHaveProperty(
      "l10n",
    );
  });
});

describe("localeCoverage", () => {
  it("reports translated, missing and stale field ids for non-hidden blocks", () => {
    expect(localeCoverage(base(), "de")).toEqual({
      translated: ["t1/content", "settings/preheaderText"],
      missing: ["img/alt"],
      stale: ["m1/items.i1.text"],
    });
  });
});

describe("path safety and clearing", () => {
  it("refuses prototype segments and leaves Object.prototype alone", () => {
    const content = base();
    (content.blocks[1] as any).l10n.de.set["styles.__proto__.polluted"] = true;
    resolveLocale(content, "de");
    expect(({} as any).polluted).toBeUndefined();
    expect(readPath({ a: 1 }, "constructor")).toBeUndefined();
  });

  it("treats null in set as absent in this language", () => {
    const content = base();
    (content.blocks[1] as any).l10n.de.set.alt = null;
    expect(resolveLocale(content, "de").blocks[1]).not.toHaveProperty("alt");
  });

  it("still reports a translation of a now-empty default as stale", () => {
    const content = base();
    (content.blocks[1] as any).alt = "";
    (content.blocks[1] as any).l10n.de.text = {
      alt: { value: "Held", source: sourceHash("Hero") },
    };
    expect(localeCoverage(content, "de").stale).toContain("img/alt");
  });
});

describe("cloneBlock", () => {
  it.each(["text", "set"] as const)(
    "scopes remapped cell ids to their row for %s paths",
    (kind) => {
      const table = createTableBlock({
        rows: [
          { id: "r1", cells: [{ id: "c1", content: "One" }] },
          { id: "r2", cells: [{ id: "c1", content: "Two" }] },
        ],
        l10n: {
          de: {
            [kind]: {
              "rows.r1.cells.c1.content":
                kind === "text"
                  ? { value: "Eins", source: sourceHash("One") }
                  : "Eins",
              "rows.r2.cells.c1.content":
                kind === "text"
                  ? { value: "Zwei", source: sourceHash("Two") }
                  : "Zwei",
            },
          },
        },
      });
      const before = JSON.stringify(table);
      const copy = cloneBlock(table) as typeof table;
      const first = `rows.${copy.rows[0].id}.cells.${copy.rows[0].cells[0].id}.content`;
      const second = `rows.${copy.rows[1].id}.cells.${copy.rows[1].cells[0].id}.content`;
      expect(Object.keys(copy.l10n!.de[kind]!)).toEqual([first, second]);
      expect(readPath(copy, first)).toBe("One");
      expect(readPath(copy, second)).toBe("Two");
      const projected = localizeBlock(copy, "de", "en") as typeof table;
      expect(projected.rows.map((row) => row.cells[0].content)).toEqual([
        "Eins",
        "Zwei",
      ]);
      expect(JSON.stringify(table)).toBe(before);
    },
  );

  it("rewrites element ids inside l10n paths", () => {
    const menu = (base().blocks[2] as any).children[0][1];
    const copy = cloneBlock(menu) as any;
    const newId = copy.items[0].id;
    expect(newId).not.toBe("i1");
    expect(Object.keys(copy.l10n.de.text)).toEqual([`items.${newId}.text`]);
  });

  it("renames only element-id positions, not property names equal to an id", () => {
    const menu = {
      id: "m",
      type: "menu",
      styles: {},
      items: [{ id: "text", text: "Shop", url: "u" }],
      l10n: {
        de: { text: { "items.text.text": { value: "Laden", source: "x" } } },
      },
    } as any;
    const copy = cloneBlock(menu) as any;
    const newId = copy.items[0].id;
    expect(Object.keys(copy.l10n.de.text)).toEqual([`items.${newId}.text`]);
  });
});
