import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createTableBlock,
  createSocialIconsBlock,
  createSlotBlock,
  createWrapperBlock,
  type CustomBlockDefinition,
} from "@templatical/types";
import { validateTemplate } from "../src/validate";
import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { runValidate } from "../src/cli/commands/validate";

const translated = { value: "Hallo", sourceHash: "00000000" };

it("validates localized layout descendants and reports unresolved layer paths", () => {
  const layout = createDefaultTemplateContent();
  layout.settings.locales = ["de"];
  const footer = createParagraphBlock({
    content: "Unsubscribe",
    l10n: { de: { text: { content: translated } } },
  });
  layout.blocks = [
    createWrapperBlock({ children: [createSlotBlock(), footer] }),
  ];
  expect(validateTemplate(layout)).toEqual({ valid: true, errors: [] });
  footer.l10n!.de.text!.missing = translated;
  expect(validateTemplate(layout).errors).toContain(
    'blocks[0].children[1].l10n["de"].text["missing"] does not resolve in its base',
  );
});
function localized(): any {
  const content: any = createDefaultTemplateContent();
  const paragraph: any = createParagraphBlock();
  paragraph.content = "Hello";
  paragraph.l10n = { de: { text: { content: translated } } };
  content.blocks = [paragraph];
  content.settings.preheaderText = "Hello";
  content.settings.locales = ["de"];
  content.settings.l10n = { de: { text: { preheaderText: translated } } };
  return content;
}

const invalid: [string, (content: any) => void, RegExp][] = [
  [
    "unsafe path before a dotted-id diagnostic",
    (c) => {
      const menu: any = createMenuBlock({
        items: [
          {
            id: "shop.__proto__.link",
            text: "Shop",
            url: "https://example.com",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
        ],
      });
      menu.l10n = {
        de: { text: { "items.shop.__proto__.link.text": translated } },
      };
      c.blocks = [menu];
    },
    /unsafe path/,
  ],
  [
    "private-use tag",
    (c) => {
      c.settings.locales = ["x-acme"];
    },
    /must be a valid locale tag \(2–3 letter language, then 2–8 character subtags\)/,
  ],
  [
    "grandfathered tag",
    (c) => {
      c.settings.locales = ["i-klingon"];
    },
    /must be a valid locale tag \(2–3 letter language, then 2–8 character subtags\)/,
  ],
  ...(["text", "set"] as const).map(
    (kind): [string, (content: any) => void, RegExp] => [
      `dotted menu item id in ${kind}`,
      (c) => {
        const menu: any = createMenuBlock({
          items: [
            {
              id: "shop.link",
              text: "Shop",
              url: "https://example.com",
              openInNewTab: false,
              bold: false,
              underline: false,
            },
          ],
        });
        menu.l10n = {
          de: {
            [kind]: {
              "items.shop.link.text": kind === "text" ? translated : "Laden",
            },
          },
        };
        c.blocks = [menu];
      },
      /Element id ".*" must not contain "\." or "\/"\./,
    ],
  ),
  ...(["row", "cell"] as const).map(
    (element): [string, (content: any) => void, RegExp] => [
      `dotted table ${element} id`,
      (c) => {
        const table: any = createTableBlock();
        table.rows[0].id = element === "row" ? "table.row" : "r1";
        table.rows[0].cells[0].id = element === "cell" ? "table.cell" : "c1";
        table.l10n = {
          de: {
            text: {
              [`rows.${table.rows[0].id}.cells.${table.rows[0].cells[0].id}.content`]:
                translated,
            },
          },
        };
        c.blocks = [table];
      },
      /Element id ".*" must not contain "\." or "\/"\./,
    ],
  ),
  [
    "invalid default tag",
    (c) => {
      c.settings.locale = "en_US";
    },
    /must be a valid locale tag \(2–3 letter language, then 2–8 character subtags\)/,
  ],
  [
    "invalid added tag",
    (c) => {
      c.settings.locales = ["de_DE"];
    },
    /must be a valid locale tag \(2–3 letter language, then 2–8 character subtags\)/,
  ],
  [
    "duplicate locale",
    (c) => {
      c.settings.locales = ["de", "de"];
    },
    /duplicate/,
  ],
  [
    "case-equivalent duplicate",
    (c) => {
      c.settings.locales = ["de", "DE"];
    },
    /duplicate/,
  ],
  [
    "default in locales",
    (c) => {
      c.settings.locales = ["en"];
    },
    /default/,
  ],
  [
    "case-equivalent default",
    (c) => {
      c.settings.locales = ["EN"];
    },
    /default/,
  ],
  [
    "undeclared block layer",
    (c) => {
      c.blocks[0].l10n.fr = { hidden: true };
    },
    /settings.locales/,
  ],
  [
    "undeclared settings layer",
    (c) => {
      c.settings.l10n.fr = { set: { width: 500 } };
    },
    /settings.locales/,
  ],
  [
    "layers without locales",
    (c) => {
      delete c.settings.locales;
    },
    /settings.locales/,
  ],
  [
    "empty locales",
    (c) => {
      c.settings.locales = [];
    },
    /must be omitted when empty/,
  ],
  [
    "empty block l10n",
    (c) => {
      c.blocks[0].l10n = {};
    },
    /must be omitted when empty/,
  ],
  [
    "empty settings l10n",
    (c) => {
      c.settings.l10n = {};
    },
    /must be omitted when empty/,
  ],
  [
    "empty block layer",
    (c) => {
      c.blocks[0].l10n.de = {};
    },
    /must be omitted when empty/,
  ],
  [
    "empty settings layer",
    (c) => {
      c.settings.l10n.de = {};
    },
    /must be omitted when empty/,
  ],
  [
    "empty block text",
    (c) => {
      c.blocks[0].l10n.de = { text: {} };
    },
    /must be omitted when empty/,
  ],
  [
    "empty block set",
    (c) => {
      c.blocks[0].l10n.de = { set: {} };
    },
    /must be omitted when empty/,
  ],
  [
    "empty settings text",
    (c) => {
      c.settings.l10n.de = { text: {} };
    },
    /must be omitted when empty/,
  ],
  [
    "empty settings set",
    (c) => {
      c.settings.l10n.de = { set: {} };
    },
    /must be omitted when empty/,
  ],
  [
    "unsafe block path",
    (c) => {
      c.blocks[0].l10n.de = { set: { "styles.__proto__.polluted": true } };
    },
    /unsafe path/,
  ],
  [
    "empty path segment",
    (c) => {
      c.blocks[0].l10n.de = { set: { "styles..padding": 0 } };
    },
    /unsafe path/,
  ],
  [
    "unsafe settings path",
    (c) => {
      c.settings.l10n.de = { set: { constructor: {} } };
    },
    /unsafe path/,
  ],
  [
    "missing block parent",
    (c) => {
      c.blocks[0].l10n.de = { set: { "missing.leaf": "x" } };
    },
    /does not resolve/,
  ],
  [
    "missing settings parent",
    (c) => {
      c.settings.l10n.de = { set: { "missing.leaf": "x" } };
    },
    /does not resolve/,
  ],
  [
    "non-text block field",
    (c) => {
      c.blocks[0].l10n.de = { text: { "styles.padding": translated } };
    },
    /not translatable/,
  ],
  [
    "non-text settings field",
    (c) => {
      c.settings.l10n.de = { text: { fontFamily: translated } };
    },
    /not translatable/,
  ],
  [
    "text and set overlap",
    (c) => {
      c.blocks[0].l10n.de.set = { content: "Hi" };
    },
    /both text and set/,
  ],
  [
    "immutable block override",
    (c) => {
      c.blocks[0].l10n.de = { set: { id: "other" } };
    },
    /cannot override/,
  ],
  [
    "localization settings override",
    (c) => {
      c.settings.l10n.de = { set: { locales: ["fr"] } };
    },
    /cannot override/,
  ],
  [
    "orphan item path",
    (c) => {
      const b: any = createMenuBlock();
      b.l10n = { de: { text: { "items.missing.text": translated } } };
      c.blocks = [b];
    },
    /does not resolve/,
  ],
  [
    "nested invalid layer",
    (c) => {
      const b = createSectionBlock();
      c.blocks[0].l10n.de = {};
      b.children = [[c.blocks[0]]];
      c.blocks = [b];
    },
    /blocks\[0\].children\[0\]\[0\].*must be omitted when empty/,
  ],
];

afterEach(() => {
  setJsonMode(false);
  vi.restoreAllMocks();
});

describe("localized template validation", () => {
  it("accepts a German direction override without a base direction", () => {
    const content = createDefaultTemplateContent();
    content.settings.locales = ["de"];
    content.settings.l10n = { de: { set: { direction: "rtl" } } };
    expect(content.settings.direction).toBeUndefined();
    expect(validateTemplate(content)).toEqual({ valid: true, errors: [] });
  });

  it("rejects an unresolved set parent beside an optional direction override", () => {
    const content = createDefaultTemplateContent();
    content.settings.locales = ["de"];
    content.settings.l10n = {
      de: { set: { direction: "rtl", "missing.direction": "rtl" } },
    };
    expect(validateTemplate(content)).toEqual({
      valid: false,
      errors: [
        'settings.l10n["de"].set["missing.direction"] does not resolve in its base',
      ],
    });
  });

  it("rejects an absent text leaf beside an optional direction override", () => {
    const content = createDefaultTemplateContent();
    content.settings.locales = ["de"];
    content.settings.l10n = {
      de: { set: { direction: "rtl" }, text: { preheaderText: translated } },
    };
    expect(content.settings.preheaderText).toBeUndefined();
    expect(validateTemplate(content)).toEqual({
      valid: false,
      errors: [
        'settings.l10n["de"].text["preheaderText"] does not resolve in its base',
      ],
    });
  });

  it.each(["text", "set"] as const)(
    "rejects a dotted sibling row id beside a resolving %s path",
    (kind) => {
      const content = localized();
      const table = createTableBlock({
        rows: [
          { id: "r1", cells: [{ id: "c1", content: "One" }] },
          { id: "r1.cells", cells: [{ id: "c1", content: "Other" }] },
        ],
        l10n: {
          de: {
            [kind]: {
              "rows.r1.cells.c1.content":
                kind === "text" ? translated : "Hallo",
            },
          },
        },
      });
      content.blocks = [table];
      expect(validateTemplate(content)).toEqual({
        valid: false,
        errors: [
          'blocks[0].rows[1].id: Element id "r1.cells" must not contain "." or "/".',
        ],
      });
    },
  );

  it("accepts translated text, settings, property overrides and hidden blocks", () => {
    const content = localized();
    content.blocks[0].l10n.de.set = { "styles.padding.top": 12 };
    content.blocks[0].l10n.de.hidden = true;
    content.settings.l10n.de.set = { width: 500 };
    expect(validateTemplate(content)).toEqual({ valid: true, errors: [] });
  });

  it("accepts id-addressed list text and BCP 47 script/region tags", () => {
    const content = localized();
    const menu: any = createMenuBlock({
      items: [
        {
          id: "shop",
          text: "Shop",
          url: "https://example.com",
          openInNewTab: false,
          bold: false,
          underline: false,
        },
      ],
    });
    menu.l10n = {
      "zh-Hant-TW": {
        text: { [`items.${menu.items[0].id}.text`]: translated },
      },
    };
    content.blocks = [menu];
    content.settings.locales = ["de", "zh-Hant-TW"];
    expect(validateTemplate(content)).toEqual({ valid: true, errors: [] });
  });

  it("accepts every declared LOC1 subtag shape without rewriting stored tags", () => {
    const content = localized();
    content.settings.locales.push("EN-a1");
    content.blocks[0].l10n["EN-a1"] = { text: { content: translated } };
    content.settings.l10n["EN-a1"] = { text: { preheaderText: translated } };
    const before = JSON.stringify(content);
    expect(validateTemplate(content)).toEqual({ valid: true, errors: [] });
    expect(JSON.stringify(content)).toBe(before);
  });

  it("compares the default and versions by lowercase only, without canonical aliases", () => {
    const content = localized();
    content.settings.locale = "he";
    content.settings.locales.push("iw");
    expect(validateTemplate(content)).toEqual({ valid: true, errors: [] });
  });

  it.each(invalid)(
    "rejects %s as a structural error and exits 1",
    async (_name, mutate, message) => {
      const content = localized();
      mutate(content);
      const result = validateTemplate(content);
      expect(result.valid).toBe(false);
      expect(result.errors.join("\n")).toMatch(message);
      const dir = mkdtempSync(join(import.meta.dirname, ".validate-l10n-"));
      try {
        const file = join(dir, "template.json");
        writeFileSync(file, JSON.stringify(content));
        let output = "";
        vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
          output += chunk;
          return true;
        });
        setJsonMode(true);
        expect(await runValidate(parseArgs(["validate", file, "--json"]))).toBe(
          1,
        );
        expect(JSON.parse(output)).toMatchObject({ valid: false, issues: [] });
        expect(JSON.parse(output).errors.join("\n")).toMatch(message);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  const definitions: CustomBlockDefinition[] = [
    {
      type: "promo",
      name: "Promo",
      template: "<mj-text>{{headline}}</mj-text>",
      fields: [
        { key: "headline", label: "Headline", type: "text" },
        { key: "body", label: "Body", type: "textarea" },
        { key: "color", label: "Color", type: "color" },
        {
          key: "items",
          label: "Items",
          type: "repeatable",
          fields: [{ key: "text", label: "Text", type: "text" }],
        },
      ],
    },
  ];

  it("uses the matching custom definition's text and textarea fields", () => {
    const content = localized();
    const custom: any = createCustomBlock(definitions[0]);
    custom.fieldValues = {
      headline: "Hello",
      body: "Body",
      color: "#000",
      items: [{ text: "Hello" }],
    };
    custom.l10n = {
      de: {
        text: {
          "fieldValues.headline": translated,
          "fieldValues.body": translated,
        },
      },
    };
    content.blocks = [custom];
    expect(validateTemplate(content, definitions)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each(["fieldValues.color", "fieldValues.items"])(
    "refuses custom non-text path %s",
    (path) => {
      const content = localized();
      const custom: any = createCustomBlock(definitions[0]);
      custom.fieldValues = { color: "#000", items: [{ text: "Hello" }] };
      custom.l10n = { de: { text: { [path]: translated } } };
      content.blocks = [custom];
      expect(validateTemplate(content, definitions).errors.join("\n")).toMatch(
        /not translatable/,
      );
    },
  );

  it("refuses custom text without a matching definition", () => {
    const content = localized();
    const custom: any = createCustomBlock(definitions[0]);
    custom.fieldValues = { headline: "Hello" };
    custom.l10n = { de: { text: { "fieldValues.headline": translated } } };
    content.blocks = [custom];
    expect(validateTemplate(content).errors.join("\n")).toMatch(
      /not translatable/,
    );
  });
});

describe("structural locale overrides", () => {
  it.each([
    [
      "columns",
      () => createSectionBlock({ columns: "2", children: [[], []] }),
      "1",
    ],
    ["items", () => createMenuBlock(), []],
    ["rows", () => createTableBlock(), []],
    [
      "rows.row.cells",
      () => createTableBlock({ rows: [{ id: "row", cells: [] }] }),
      [],
    ],
    ["icons", () => createSocialIconsBlock(), []],
  ] as const)("refuses the structural path %s", (path, make, value) => {
    const content = localized();
    const block = make();
    block.l10n = { de: { set: { [path]: value } } };
    content.blocks = [block];
    const result = validateTemplate(content);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/cannot override structure/);
  });
});

it.each([
  ["required styles", "title", { styles: null }],
  ["invalid style type", "title", { "styles.fontSize": "large" }],
  ["required items", "menu", { items: null }],
  ["required width", "settings", { width: null }],
] as const)(
  "validates each resolved language: %s",
  async (_name, type, set) => {
    const { createTitleBlock } = await import("@templatical/types");
    const content = localized();
    if (type === "settings") content.settings.l10n.de = { set };
    else {
      const block = type === "title" ? createTitleBlock() : createMenuBlock();
      block.l10n = { de: { set } };
      content.blocks = [block];
    }
    const result = validateTemplate(content);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("de");
  },
);

describe("built-in list element structure", () => {
  const folder = join(
    import.meta.dirname,
    "../../types/tests/fixtures/operations",
  );
  it.each(
    readdirSync(folder).filter((name) =>
      /locale-structural-.*-(id|replacement)\.json$/.test(name),
    ),
  )("refuses %s in stored templates", (name) => {
    const fixture = JSON.parse(readFileSync(join(folder, name), "utf8"));
    const source = fixture.content.blocks[0];
    if (source.type === "menu")
      source.items = source.items.map((item: object) => ({
        openInNewTab: false,
        bold: false,
        underline: false,
        ...item,
      }));
    const block =
      source.type === "menu"
        ? createMenuBlock(source)
        : source.type === "table"
          ? createTableBlock(source)
          : createSocialIconsBlock(source);
    block.l10n = { de: { set: fixture.ops[0].set } };
    const content = createDefaultTemplateContent();
    content.settings.locales = ["de"];
    content.blocks = [block];
    const result = validateTemplate(content);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("cannot override structure");
  });
});
