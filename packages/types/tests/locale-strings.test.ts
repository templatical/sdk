import { describe, expect, it, onTestFinished, vi } from "vitest";
import {
  applyOperations,
  applyLocaleStrings,
  createDefaultTemplateContent,
  createCustomBlock,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createTableBlock,
  createTitleBlock,
  localeCoverage,
  localeStrings,
  maskTags,
  sourceHash,
  SYNTAX_PRESETS,
  unmaskTags,
  type CustomBlockDefinition,
} from "../src";
import * as localization from "../src/localization";

const liquid = SYNTAX_PRESETS.liquid;
const options = { syntax: liquid, only: "all" as const };
const chip =
  '<span data-merge-tag="{{first_name}}">First <span>name</span></span>';
const logicChip = '<span data-logic-merge-tag="{% if vip %}">VIP</span>';

function fixture() {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.settings.preheaderText = "Save now";
  content.blocks = [
    createParagraphBlock({ id: "p", content: "<p>Hello {{name}}</p>" }),
    createImageBlock({ id: "img", alt: "Hero" }),
    createMenuBlock({
      id: "menu",
      items: [{ id: "shop", text: "Shop", url: "https://example.com" }],
    }),
  ];
  return content;
}

function extract(content = fixture(), only: "all" | "gaps" = "all") {
  return localeStrings(content, "de", { ...options, only });
}

function values(extracted: ReturnType<typeof localeStrings>) {
  return extracted.strings.map((field) => ({
    id: field.id,
    text: field.source,
    sourceHash: field.sourceHash,
  }));
}

describe("maskTags", () => {
  it("masks chips whole and raw tags in document order, preserving original bytes", () => {
    const html = `<p>{{before}} Hi ${chip}, {{ city }} and {{first_name}}</p>`;
    const masked = maskTags(html, liquid, "html");
    expect(masked).toEqual({
      text: '<p><x id="1"/> Hi <x id="2"/>, <x id="3"/> and <x id="4"/></p>',
      tokens: ["{{before}}", chip, "{{ city }}", "{{first_name}}"],
    });
    expect(
      unmaskTags(
        '<p><x id="4"/> und <x id="2"/>, <x id="3"/> <x id="1"/></p>',
        masked.tokens,
      ),
    ).toBe(`<p>{{first_name}} und ${chip}, {{ city }} {{before}}</p>`);
  });

  it("masks logic chips whole", () => {
    expect(maskTags(`${logicChip}Hello {% endif %}`, liquid, "html")).toEqual({
      text: '<x id="1"/>Hello <x id="2"/>',
      tokens: [logicChip, "{% endif %}"],
    });
  });

  it.each([
    [
      "handlebars",
      "{{#if vip}}{{{name}}}{{/if}}",
      ["{{#if vip}}", "{{{name}}}", "{{/if}}"],
    ],
    [
      "mailchimp",
      "*|IF:VIP|**|NAME|**|END:IF|*",
      ["*|IF:VIP|*", "*|NAME|*", "*|END:IF|*"],
    ],
    [
      "ampscript",
      "%%[ if vip then ]%%%%=name=%%%%[ endif ]%%",
      ["%%[ if vip then ]%%", "%%=name=%%", "%%[ endif ]%%"],
    ],
  ] as const)(
    "masks the %s syntax without overlapping value and logic matches",
    (preset, text, tokens) => {
      expect(maskTags(text, SYNTAX_PRESETS[preset], "text")).toEqual({
        text: '<x id="1"/><x id="2"/><x id="3"/>',
        tokens: [...tokens],
      });
    },
  );

  it("uses global regex copies without changing caller lastIndex", () => {
    const syntax = { value: /\{\{.+?\}\}/, logic: /\{%.*?%\}/g };
    syntax.logic.lastIndex = 8;
    expect(maskTags("{{a}} {% if a %} {{b}}", syntax, "text").tokens).toEqual([
      "{{a}}",
      "{% if a %}",
      "{{b}}",
    ]);
    expect(syntax.logic.lastIndex).toBe(8);
  });

  it("uses quote-safe attribute tokens and one sequence with chips and text", () => {
    const html = `<p>{{before}} <a href="{{url}}" title='{{title}}'>${chip} {{after}}</a></p>`;
    const masked = maskTags(html, liquid, "html");
    expect(masked.text).toBe(
      '<p><x id="1"/> <a href="__x2__" title=\'__x3__\'><x id="4"/> <x id="5"/></a></p>',
    );
    expect(masked.tokens).toEqual([
      "{{before}}",
      "{{url}}",
      "{{title}}",
      chip,
      "{{after}}",
    ]);
    expect(unmaskTags(masked.text, masked.tokens)).toBe(html);
  });

  it("skips chip handling in text format", () => {
    expect(
      maskTags('<span data-merge-tag="{{name}}">Name</span>', liquid, "text"),
    ).toEqual({
      text: '<span data-merge-tag="<x id="1"/>">Name</span>',
      tokens: ["{{name}}"],
    });
  });
});

describe("unmaskTags", () => {
  it.each([
    'Hallo <x id="1"/>',
    'Hallo <x id="1"/> <x id="1"/> <x id="2"/>',
    'Hallo <x id="1"/> <x id="3"/>',
    "Hallo __x1__ __x1__ __x2__",
    'Hallo <x id="1"/> __x2__ __x3__',
    'Hallo <x id="0"/> __x2__',
  ])("refuses a missing, repeated or unknown placeholder: %s", (text) => {
    expect(unmaskTags(text, ["{{a}}", "{{b}}"])).toBeNull();
  });

  it("accepts paired, spaced and attribute placeholders in any order", () => {
    expect(
      unmaskTags('<x id="3"></x> __x1__ <x id="2" />', [
        "{{a}}",
        "{{b}}",
        "{{c}}",
      ]),
    ).toBe("{{c}} {{a}} {{b}}");
    expect(unmaskTags("Hallo", [])).toBe("Hallo");
    expect(unmaskTags('<x id="1"/>', [])).toBeNull();
  });
});

describe("localeStrings", () => {
  it("classifies gaps as missing and stale, and all as every eligible field", () => {
    const content = fixture();
    content.blocks[0].l10n = {
      de: {
        text: {
          content: {
            value: "<p>Hallo {{name}}</p>",
            sourceHash: sourceHash("<p>Hello {{name}}</p>"),
          },
        },
      },
    };
    content.blocks[1].l10n = {
      de: { text: { alt: { value: "Held", sourceHash: "old" } } },
    };
    expect(extract(content, "gaps").strings.map((s) => s.id)).toEqual([
      "img/alt",
      "menu/items.shop.text",
      "settings/preheaderText",
    ]);
    expect(extract(content).strings).toEqual([
      {
        id: "p/content",
        format: "html",
        source: '<p>Hello <x id="1"/></p>',
        sourceHash: sourceHash("<p>Hello {{name}}</p>"),
        text: '<p>Hallo <x id="1"/></p>',
      },
      {
        id: "img/alt",
        format: "text",
        source: "Hero",
        sourceHash: sourceHash("Hero"),
        text: "Held",
      },
      {
        id: "menu/items.shop.text",
        format: "text",
        source: "Shop",
        sourceHash: sourceHash("Shop"),
      },
      {
        id: "settings/preheaderText",
        format: "text",
        source: "Save now",
        sourceHash: sourceHash("Save now"),
      },
    ]);
  });

  it("selects every eligible field for all without a coverage pass, which only gaps needs", () => {
    const coverage = vi.spyOn(localization, "localeCoverage");
    onTestFinished(() => coverage.mockRestore());
    const content = fixture();
    content.blocks[1].l10n = {
      de: { text: { alt: { value: "Held", sourceHash: "old" } } },
    };
    expect(extract(content).strings.map((s) => s.id)).toEqual([
      "p/content",
      "img/alt",
      "menu/items.shop.text",
      "settings/preheaderText",
    ]);
    expect(coverage).not.toHaveBeenCalled();
    expect(extract(content, "gaps").strings.map((s) => s.id)).toEqual([
      "p/content",
      "img/alt",
      "menu/items.shop.text",
      "settings/preheaderText",
    ]);
    expect(coverage).toHaveBeenCalledOnce();
  });

  it("filters to one block without including settings", () => {
    expect(
      localeStrings(fixture(), "de", {
        ...options,
        blockId: "img",
      }).strings.map((s) => s.id),
    ).toEqual(["img/alt"]);
  });

  it("excludes empty defaults even when stale, set overrides, hidden subtrees, dotted elements and raw HTML", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({
        id: "empty",
        content: "",
        l10n: {
          de: { text: { content: { value: "Alt", sourceHash: "old" } } },
        },
      }),
      createImageBlock({
        id: "set",
        alt: "Hero",
        l10n: { de: { set: { alt: "Held" } } },
      }),
      createSectionBlock({
        id: "hidden",
        l10n: { de: { hidden: true } },
        children: [[createParagraphBlock({ content: "Hidden child" })]],
      }),
      createHtmlBlock({ id: "html", content: "<p>Raw</p>" }),
      createMenuBlock({
        id: "dots",
        items: [{ id: "bad.id", text: "No", url: "https://example.com" }],
      }),
      createTableBlock({
        id: "table",
        rows: [
          { id: "bad.row", cells: [{ id: "c", content: "No" }] },
          {
            id: "r",
            cells: [
              { id: "bad.cell", content: "No" },
              { id: "c", content: "Yes" },
            ],
          },
        ],
      }),
    ];
    content.settings.l10n = { de: { set: { preheaderText: "Eigener Text" } } };
    expect(extract(content).strings.map((s) => s.id)).toEqual([
      "table/rows.r.cells.c.content",
    ]);
  });

  it("treats title content as html and custom text and textarea as text", () => {
    const definitions: CustomBlockDefinition[] = [
      {
        type: "card",
        name: "Card",
        template: "",
        fields: [
          { key: "label", label: "Label", type: "text", default: "Hello" },
          { key: "body", label: "Body", type: "textarea", default: "Body" },
        ],
      },
    ];
    const content = fixture();
    const custom = createCustomBlock(definitions[0]);
    custom.id = "card";
    content.blocks = [
      createTitleBlock({ id: "title", content: "<p>Title</p>" }),
      custom,
    ];
    expect(
      localeStrings(content, "de", { ...options, definitions }).strings.map(
        (s) => [s.id, s.format],
      ),
    ).toEqual([
      ["title/content", "html"],
      ["card/fieldValues.label", "text"],
      ["card/fieldValues.body", "text"],
      ["settings/preheaderText", "text"],
    ]);
  });

  it("round-trips JSON with source token ids for reordered and repeated tags", () => {
    const content = fixture();
    const paragraph = createParagraphBlock({
      id: "p",
      content: '<p>{{a}} <a href="{{url}}">{{b}}</a> {{a}}</p>',
      l10n: {
        de: {
          text: {
            content: {
              value: '<p>{{b}} {{a}} <a href="{{url}}">{{a}}</a></p>',
              sourceHash: "old",
            },
          },
        },
      },
    });
    content.blocks = [paragraph];
    const file = JSON.parse(JSON.stringify(extract(content)));
    expect(file.strings[0].text).toBe(
      '<p><x id="3"/> <x id="1"/> <a href="__x2__"><x id="4"/></a></p>',
    );
    const result = applyLocaleStrings(
      content,
      "de",
      file.strings.map(
        (s: {
          id: string;
          text?: string;
          source: string;
          sourceHash: string;
        }) => ({ ...s, text: s.text ?? s.source }),
      ),
      { syntax: liquid, tokens: file.tokens },
    );
    expect(result.rejected).toEqual([]);
    expect(
      applyOperations(content, result.operations).blocks[0].l10n?.de.text
        ?.content,
    ).toEqual({
      value: paragraph.l10n!.de.text!.content.value,
      sourceHash: sourceHash(paragraph.content),
    });
  });

  it.each(["gaps", "all"] as const)(
    "exports the current source without incompatible translated text under %s",
    (only) => {
      const content = fixture();
      content.blocks[0] = createParagraphBlock({
        id: "p",
        content: "Hello {{first_name}}",
        l10n: {
          de: {
            text: {
              content: {
                value: "Hallo {{name}}",
                sourceHash: sourceHash("Hello {{name}}"),
              },
            },
          },
        },
      });
      const extracted = extract(content, only);
      expect(extracted.strings[0]).toEqual({
        id: "p/content",
        format: "html",
        source: 'Hello <x id="1"/>',
        sourceHash: sourceHash("Hello {{first_name}}"),
      });
      expect(extracted.tokens["p/content"]).toEqual(["{{first_name}}"]);
    },
  );
});

describe("applyLocaleStrings", () => {
  it.each([
    [
      "an added raw value tag",
      "<p>Hello {{name}}</p>",
      '<p>Hallo <x id="1"/> {{name}}</p>',
    ],
    [
      "an added logic tag",
      "<p>Hello {{name}}</p>",
      '<p>Hallo <x id="1"/> {% if vip %}</p>',
    ],
    [
      "an added chip",
      "<p>Hello {{name}}</p>",
      `<p>Hallo <x id="1"/> ${chip}</p>`,
    ],
    [
      "a new tag in a source with no tags",
      "<p>Hello</p>",
      "<p>Hallo {{invented}}</p>",
    ],
    [
      "a changed restored tag",
      "<p>Hello {{name}}</p>",
      '<p>{{<x id="1"/>}}</p>',
    ],
    [
      "a raw tag replaced by a chip",
      "<p>Hello {{name}}</p>",
      '<span data-merge-tag="<x id="1"/>">Name</span>',
    ],
  ])(
    "rejects %s after restoring placeholders",
    (_label, source, translated) => {
      const content = fixture();
      content.blocks = [createParagraphBlock({ id: "p", content: source })];
      const extracted = extract(content);
      const result = applyLocaleStrings(
        content,
        "de",
        [
          {
            id: "p/content",
            text: translated,
            sourceHash: sourceHash(source),
          },
        ],
        { syntax: liquid, tokens: extracted.tokens },
      );
      expect(result.operations).toEqual([]);
      expect(result.rejected).toEqual([
        { id: "p/content", reason: "tags_changed" },
      ]);
    },
  );

  it("checks restored tags with the supplied custom syntax", () => {
    const syntax = { value: /\[\[.+?\]\]/g, logic: /\[%.*?%\]/g };
    const content = fixture();
    content.blocks = [
      createParagraphBlock({ id: "p", content: "<p>Hello [[name]]</p>" }),
    ];
    const extracted = localeStrings(content, "de", { ...options, syntax });
    const result = applyLocaleStrings(
      content,
      "de",
      [
        {
          id: "p/content",
          text: '<p>Hallo <x id="1"/> [[invented]]</p>',
          sourceHash: sourceHash("<p>Hello [[name]]</p>"),
        },
      ],
      { syntax, tokens: extracted.tokens },
    );
    expect(result.operations).toEqual([]);
    expect(result.rejected).toEqual([
      { id: "p/content", reason: "tags_changed" },
    ]);
  });

  it("round-trips a block named settings separately from the translated preheader", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({ id: "settings", content: "<p>Hello</p>" }),
    ];
    const extracted = extract(content);
    expect(extracted.strings.map((field) => field.id)).toEqual([
      "settings/content",
      "settings/preheaderText",
    ]);
    const result = applyLocaleStrings(
      content,
      "de",
      values(extracted).map((value) => ({
        ...value,
        text: value.id === "settings/content" ? "<p>Hallo</p>" : "Jetzt sparen",
      })),
      { syntax: liquid, tokens: extracted.tokens },
    );
    expect(result.rejected).toEqual([]);
    expect(result.operations).toEqual([
      {
        op: "updateBlockLocale",
        blockId: "settings",
        locale: "de",
        text: {
          content: {
            value: "<p>Hallo</p>",
            sourceHash: sourceHash("<p>Hello</p>"),
          },
        },
      },
      {
        op: "updateSettingsLocale",
        locale: "de",
        text: {
          preheaderText: {
            value: "Jetzt sparen",
            sourceHash: sourceHash("Save now"),
          },
        },
      },
    ]);
    const applied = applyOperations(content, result.operations);
    expect(applied.blocks[0].l10n?.de.text).toEqual({
      content: {
        value: "<p>Hallo</p>",
        sourceHash: sourceHash("<p>Hello</p>"),
      },
    });
    expect(applied.settings.l10n?.de.text).toEqual({
      preheaderText: {
        value: "Jetzt sparen",
        sourceHash: sourceHash("Save now"),
      },
    });
    expect(localeCoverage(applied, "de")).toEqual({
      translated: ["settings/content", "settings/preheaderText"],
      missing: [],
      stale: [],
    });
  });

  it("filters a block named settings without selecting the settings preheader", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({ id: "settings", content: "<p>Hello</p>" }),
    ];
    const extracted = localeStrings(content, "de", {
      ...options,
      blockId: "settings",
    });
    expect(extracted.strings.map((field) => field.id)).toEqual([
      "settings/content",
    ]);
    expect(Object.keys(extracted.tokens)).toEqual(["settings/content"]);
    const result = applyLocaleStrings(content, "de", values(extracted), {
      syntax: liquid,
      tokens: extracted.tokens,
    });
    const applied = applyOperations(content, result.operations);
    expect(applied.blocks[0].l10n?.de.text?.content.value).toBe("<p>Hello</p>");
    expect(applied.settings.l10n).toBeUndefined();
  });

  it("groups values into one operation per block and at most one settings operation", () => {
    const content = fixture();
    content.blocks.push(
      createTableBlock({
        id: "table",
        rows: [
          {
            id: "r",
            cells: [
              { id: "a", content: "One" },
              { id: "b", content: "Two" },
            ],
          },
        ],
      }),
    );
    const before = JSON.stringify(content);
    const extracted = extract(content);
    const result = applyLocaleStrings(content, "de", values(extracted), {
      syntax: liquid,
      tokens: extracted.tokens,
    });
    expect(result.rejected).toEqual([]);
    expect(
      result.operations.map((op) =>
        op.op === "updateBlockLocale"
          ? [op.op, op.blockId, Object.keys(op.text!)]
          : [op.op],
      ),
    ).toEqual([
      ["updateBlockLocale", "p", ["content"]],
      ["updateBlockLocale", "img", ["alt"]],
      ["updateBlockLocale", "menu", ["items.shop.text"]],
      [
        "updateBlockLocale",
        "table",
        ["rows.r.cells.a.content", "rows.r.cells.b.content"],
      ],
      ["updateSettingsLocale"],
    ]);
    const applied = applyOperations(content, result.operations);
    const coverage = localeCoverage(applied, "de");
    expect(
      extracted.strings.every((s) => coverage.translated.includes(s.id)),
    ).toBe(true);
    expect(coverage.missing).toEqual([]);
    expect(coverage.stale).toEqual([]);
    expect(JSON.stringify(content)).toBe(before);
  });

  it("stamps the extraction hash even if the default changes before applying", () => {
    const content = fixture();
    const extracted = extract(content);
    (content.blocks[0] as ReturnType<typeof createParagraphBlock>).content =
      "<p>Changed {{name}}</p>";
    const result = applyLocaleStrings(content, "de", values(extracted), {
      syntax: liquid,
      tokens: extracted.tokens,
    });
    const applied = applyOperations(content, result.operations);
    expect(applied.blocks[0].l10n?.de.text?.content.sourceHash).toBe(
      sourceHash("<p>Hello {{name}}</p>"),
    );
    expect(localeCoverage(applied, "de").stale).toEqual(["p/content"]);
  });

  it("rejects changed tags, unknown fields and non-translatable fields", () => {
    const content = fixture();
    const extracted = extract(content);
    const result = applyLocaleStrings(
      content,
      "de",
      [
        { id: "p/content", text: "Hallo", sourceHash: "old" },
        { id: "gone/content", text: "Hallo", sourceHash: "old" },
        { id: "p/missing", text: "Hallo", sourceHash: "old" },
        { id: "img/alt", text: "Held", sourceHash: "old" },
        {
          id: "menu/items.shop.url",
          text: "https://example.de",
          sourceHash: "old",
        },
      ],
      { syntax: liquid, tokens: extracted.tokens },
    );
    expect(result.rejected).toEqual([
      { id: "p/content", reason: "tags_changed" },
      { id: "gone/content", reason: "unknown_field" },
      { id: "p/missing", reason: "unknown_field" },
      { id: "menu/items.shop.url", reason: "not_translatable" },
    ]);
    expect(result.operations).toEqual([
      {
        op: "updateBlockLocale",
        blockId: "img",
        locale: "de",
        text: { alt: { value: "Held", sourceHash: "old" } },
      },
    ]);
  });

  it.each(["empty", "set", "hidden", "html", "removed", "settings-set"])(
    "re-checks %s eligibility at apply time",
    (change) => {
      const content = fixture();
      const extracted = extract(content);
      if (change === "empty")
        (content.blocks[0] as ReturnType<typeof createParagraphBlock>).content =
          "";
      if (change === "set")
        content.blocks[0].l10n = { de: { set: { content: "Manual" } } };
      if (change === "hidden")
        content.blocks[0].l10n = { de: { hidden: true } };
      if (change === "html")
        content.blocks[0] = createHtmlBlock({
          id: "p",
          content: "<p>Hello {{name}}</p>",
        });
      if (change === "removed") content.blocks.shift();
      if (change === "settings-set")
        content.settings.l10n = { de: { set: { preheaderText: "Manual" } } };
      const id =
        change === "settings-set" ? "settings/preheaderText" : "p/content";
      const result = applyLocaleStrings(
        content,
        "de",
        values(extracted).filter((s) => s.id === id),
        { syntax: liquid, tokens: extracted.tokens },
      );
      expect(result.operations).toEqual([]);
      expect(result.rejected).toEqual([
        {
          id,
          reason: change === "removed" ? "unknown_field" : "not_translatable",
        },
      ]);
    },
  );
});
