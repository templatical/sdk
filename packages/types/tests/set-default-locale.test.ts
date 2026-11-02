import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyOperations,
  applyOperationsInPlace,
  createSetDefaultLocaleOperation,
  resolveLocale,
  invertOperations,
  defaultLocaleGaps,
  localeCoverage,
  createDefaultTemplateContent,
  createTitleBlock,
  createHtmlBlock,
  createImageBlock,
  createCustomBlock,
  createMenuBlock,
  sourceHash,
  safeClone,
  type Operation,
  type SetDefaultLocaleOperation,
  type CustomBlockDefinition,
  type TemplateContent,
} from "../src";

const op = { op: "setDefaultLocale", locale: "de" } as Operation;
const text = (value: string, source = "Hello") => ({
  value,
  sourceHash: sourceHash(source),
});
function seed(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.direction = "ltr";
  content.settings.locales = ["de", "fr"];
  content.blocks = [
    createTitleBlock({
      id: "t1",
      content: "Hello",
      l10n: { de: { text: { content: text("Hallo") } } },
    }),
  ];
  return content;
}
function promote(content = seed()) {
  return applyOperations(content, [op]);
}
function roundTrip(before: TemplateContent) {
  const original = safeClone(before);
  const after = promote(before);
  expect(applyOperations(after, invertOperations(before, [op]))).toEqual(
    original,
  );
  expect(before).toEqual(original);
  return after;
}

describe("setDefaultLocale", () => {
  it("promotes text and property overrides including null", () => {
    const before = seed();
    before.blocks.push(
      createImageBlock({
        id: "img",
        src: "https://example.com/en.png",
        linkUrl: "https://example.com",
        l10n: {
          de: { set: { src: "https://example.com/de.png", linkUrl: null } },
        },
      }),
    );
    const after = roundTrip(before);
    expect(after.blocks[0]).toMatchObject({ content: "Hallo" });
    expect(after.blocks[1]).toMatchObject({
      src: "https://example.com/de.png",
    });
    expect(after.blocks[1]).not.toHaveProperty("linkUrl");
    expect(after.blocks[1].l10n).toEqual({
      en: {
        set: {
          src: "https://example.com/en.png",
          linkUrl: "https://example.com",
        },
      },
    });
  });
  it("stores the former default against the new base, and equal text as a current entry", () => {
    const before = seed();
    before.blocks.push(
      createTitleBlock({
        id: "equal",
        content: "Hello",
        l10n: { de: { text: { content: text("Hello", "Earlier") } } },
      }),
    );
    const after = roundTrip(before);
    expect(after.blocks[0].l10n).toEqual({
      en: { text: { content: text("Hello", "Hallo") } },
    });
    expect(after.blocks[1].l10n).toEqual({
      en: { text: { content: text("Hello", "Hello") } },
    });
  });
  it("keeps gap text at the former base as a current old-default entry and inverts exactly", () => {
    const before = seed();
    before.blocks.push(createTitleBlock({ id: "gap", content: "Missing" }));
    const after = roundTrip(before);
    expect(after.blocks[1]).toEqual({
      ...before.blocks[1],
      l10n: { en: { text: { content: text("Missing", "Missing") } } },
    });
    expect(localeCoverage(after, "en")).toEqual({
      missing: [],
      stale: [],
      translated: ["t1/content", "gap/content"],
    });
    expect(
      JSON.stringify(applyOperations(after, invertOperations(before, [op]))),
    ).toBe(JSON.stringify(before));
  });
  it.each([
    ["current", "Hello", "Hallo", false],
    ["stale", "Earlier", "Earlier", true],
    ["converges", "Hallo", "Hallo", false],
  ] as const)(
    "preserves the other language's %s state",
    (_name, stored, expected, stale) => {
      const before = seed();
      before.blocks[0].l10n!.fr = {
        text: { content: text("Bonjour", stored) },
      };
      const after = roundTrip(before);
      expect(after.blocks[0].l10n!.fr.text!.content.sourceHash).toBe(
        sourceHash(expected),
      );
      expect(localeCoverage(after, "fr").stale.includes("t1/content")).toBe(
        stale,
      );
    },
  );
  it("drops custom renderedHtml only when fieldValues change", () => {
    const before = seed();
    before.blocks = ["Changed", "Same"].map((value, i) => ({
      ...createCustomBlock({
        type: "card",
        name: "Card",
        template: "",
        fields: [],
      }),
      id: `c${i}`,
      fieldValues: { label: "Same" },
      renderedHtml: "<p>Same</p>",
      l10n: { de: { text: { "fieldValues.label": text(value, "Same") } } },
    }));
    const after = roundTrip(before);
    expect(after.blocks[0]).not.toHaveProperty("renderedHtml");
    expect(after.blocks[1]).toHaveProperty("renderedHtml", "<p>Same</p>");
    expect(after.blocks[0].l10n!.en.text!["fieldValues.label"]).toEqual(
      text("Same", "Changed"),
    );
  });
  it("replaces the version's index with the former default and promotes settings", () => {
    const before = seed();
    before.settings.preheaderText = "Hello";
    before.settings.l10n = {
      de: { text: { preheaderText: text("Hallo") }, set: { direction: "rtl" } },
    };
    const after = roundTrip(before);
    expect(after.settings).toMatchObject({
      locale: "de",
      locales: ["en", "fr"],
      preheaderText: "Hallo",
      direction: "rtl",
      l10n: {
        en: {
          text: { preheaderText: text("Hello", "Hallo") },
          set: { direction: "ltr" },
        },
      },
    });
  });
  it("converts translations of a removed optional default to set entries", () => {
    const before = seed();
    before.settings.preheaderText = "Hello";
    before.settings.l10n = {
      de: { set: { preheaderText: null } },
      fr: { text: { preheaderText: text("Bonjour") } },
    };
    const after = roundTrip(before);
    expect(after.settings).not.toHaveProperty("preheaderText");
    expect(after.settings.l10n).toEqual({
      en: { set: { preheaderText: "Hello" } },
      fr: { set: { preheaderText: "Bonjour" } },
    });
  });
  it("rebases list leaves and text under overlapping property overrides", () => {
    const before = seed();
    before.blocks = [
      createMenuBlock({
        id: "menu",
        items: [{ id: "home", text: "Home", url: "/en" }],
        l10n: {
          de: {
            set: { "items.home": { id: "home", text: "Start", url: "/de" } },
          },
          fr: { text: { "items.home.text": text("Accueil", "Home") } },
        },
      }),
    ];
    const after = roundTrip(before);
    expect(after.blocks[0]).toMatchObject({
      items: [{ id: "home", text: "Start", url: "/de" }],
      l10n: {
        en: { set: { "items.home": { id: "home", text: "Home", url: "/en" } } },
        fr: { text: { "items.home.text": text("Accueil", "Start") } },
      },
    });
  });
  it.each(["es", "en"])(
    "refuses %s with the membership message and leaves the input untouched",
    (locale) => {
      const before = seed();
      const original = safeClone(before);
      expect(() =>
        applyOperations(before, [
          { op: "setDefaultLocale", locale } as Operation,
        ]),
      ).toThrowError(
        expect.objectContaining({
          code: "invalid_operation",
          opIndex: 0,
          message: `"${locale}" is not a language version of this template.`,
        }),
      );
      expect(before).toEqual(original);
    },
  );
  it("refuses hidden blocks with their count and first id", () => {
    const before = seed();
    before.blocks[0].l10n!.de.hidden = true;
    before.blocks.push(
      createTitleBlock({ id: "other", l10n: { de: { hidden: true } } }),
    );
    const original = safeClone(before);
    expect(() => promote(before)).toThrowError(
      expect.objectContaining({
        code: "invalid_operation",
        blockId: "t1",
        message:
          '2 blocks are hidden in "de". Show them before making it the default.',
      }),
    );
    expect(before).toEqual(original);
  });
  it("conflicts with every other session's language lock but permits its own", () => {
    const before = seed();
    for (const locale of [null, "fr", "de"]) {
      expect(() =>
        applyOperations(before, [op], {
          locks: [{ blockId: "t1", sessionId: "other", locale }],
          session: "me",
        }),
      ).toThrowError(
        expect.objectContaining({ code: "locked_by_others", blockId: "t1" }),
      );
    }
    expect(
      applyOperations(before, [op], {
        locks: [{ blockId: "t1", sessionId: "me" }],
        session: "me",
      }).settings.locale,
    ).toBe("de");
  });
  it("still refuses updateSettings default changes while versions exist", () => {
    const after = promote();
    expect(after.settings.locale).toBe("de");
    expect(() =>
      applyOperations(after, [{ op: "updateSettings", set: { locale: "en" } }]),
    ).toThrowError(expect.objectContaining({ code: "invalid_operation" }));
  });
});

describe("defaultLocaleGaps", () => {
  it("counts missing values but excludes applicable set overrides and stale text", () => {
    const before = seed();
    before.blocks.push(
      createTitleBlock({ id: "gap", content: "Gap" }),
      createMenuBlock({
        id: "menu",
        items: [{ id: "home", text: "Home", url: "/" }],
        l10n: {
          de: {
            set: { "items.home": { id: "home", text: "Start", url: "/de" } },
          },
        },
      }),
    );
    before.blocks[0].l10n!.de.text!.content.sourceHash = sourceHash("Earlier");
    before.settings.preheaderText = "Preview";
    const original = safeClone(before);
    expect(defaultLocaleGaps(before, "de")).toEqual([
      "gap/content",
      "settings/preheaderText",
    ]);
    expect(before).toEqual(original);
  });
});

it("keeps custom property overrides out of text when the operation has no field definitions", () => {
  const before = seed();
  before.blocks = [
    {
      ...createCustomBlock({
        type: "card",
        name: "Card",
        template: "",
        fields: [],
      }),
      id: "custom",
      fieldValues: { variant: "standard", headline: "Hello" },
      l10n: {
        de: {
          set: { "fieldValues.variant": "compact" },
          text: { "fieldValues.headline": text("Hallo") },
        },
      },
    },
  ];
  const after = roundTrip(before);
  expect(after.blocks[0].l10n!.en).toEqual({
    set: { "fieldValues.variant": "standard" },
    text: { "fieldValues.headline": text("Hello", "Hallo") },
  });
});

it("keeps text the new default translated to the same value as a current entry of the old default", () => {
  const before = seed();
  before.blocks.push(
    createTitleBlock({
      id: "brand",
      content: "Sable",
      l10n: { de: { text: { content: text("Sable", "Sable") } } },
    }),
  );
  before.settings.preheaderText = "Sable";
  before.settings.l10n = {
    de: { text: { preheaderText: text("Sable", "Sable") } },
  };
  expect(defaultLocaleGaps(before, "de")).toEqual([]);
  const after = roundTrip(before);
  expect(after.blocks[1].l10n).toEqual({
    en: { text: { content: text("Sable", "Sable") } },
  });
  expect(after.settings.l10n?.en).toEqual({
    text: { preheaderText: text("Sable", "Sable") },
  });
  const english = localeCoverage(after, "en");
  expect(english.missing).toEqual([]);
  expect(english.translated).toEqual(
    expect.arrayContaining(["brand/content", "settings/preheaderText"]),
  );
});

it("keeps an old-default gap value when the new base later changes and marks it stale", () => {
  const before = seed();
  before.blocks.push(createTitleBlock({ id: "gap", content: "Gap" }));
  const after = roundTrip(before);
  const edited = applyOperations(after, [
    { op: "updateBlock", blockId: "gap", set: { content: "German now" } },
  ]);
  expect(resolveLocale(edited, "en").blocks[1]).toMatchObject({
    content: "Gap",
  });
  expect(edited.blocks[1].l10n?.en.text?.content).toEqual(text("Gap", "Gap"));
  expect(localeCoverage(edited, "en")).toEqual({
    missing: [],
    stale: ["gap/content"],
    translated: ["t1/content"],
  });
});

it("preserves missing preheader and HTML text as current old-default entries", () => {
  const before = seed();
  before.settings.preheaderText = "English preview";
  before.blocks.push(
    createHtmlBlock({ id: "html", content: "<p>English HTML</p>" }),
  );
  expect(defaultLocaleGaps(before, "de")).toEqual([
    "html/content",
    "settings/preheaderText",
  ]);
  const after = roundTrip(before);
  expect(after.settings.preheaderText).toBe("English preview");
  expect(after.settings.l10n?.en.text?.preheaderText).toEqual(
    text("English preview", "English preview"),
  );
  expect(after.blocks[1]).toMatchObject({
    content: "<p>English HTML</p>",
    l10n: {
      en: {
        text: { content: text("<p>English HTML</p>", "<p>English HTML</p>") },
      },
    },
  });
  expect(localeCoverage(after, "en").missing).toEqual([]);
  expect(localeCoverage(after, "en").stale).toEqual([]);
  const edited = applyOperations(after, [
    { op: "updateSettings", set: { preheaderText: "Deutsche Vorschau" } },
    {
      op: "updateBlock",
      blockId: "html",
      set: { content: "<p>Deutsches HTML</p>" },
    },
  ]);
  const english = resolveLocale(edited, "en");
  expect(english.settings.preheaderText).toBe("English preview");
  expect(english.blocks[1]).toMatchObject({ content: "<p>English HTML</p>" });
  expect(localeCoverage(edited, "en")).toEqual({
    missing: [],
    stale: ["html/content", "settings/preheaderText"],
    translated: ["t1/content"],
  });
});

it("replays custom text and textarea gaps from captured metadata without definitions and inverts exactly", () => {
  const definitions: CustomBlockDefinition[] = [
    {
      type: "card",
      name: "Card",
      template: "",
      fields: [
        { key: "headline", type: "text", label: "Headline" },
        { key: "body", type: "textarea", label: "Body" },
        { key: "empty", type: "text", label: "Empty" },
        { key: "color", type: "color", label: "Color" },
      ],
    },
  ];
  const before = seed();
  before.blocks = [
    {
      ...createCustomBlock(definitions[0]),
      id: "custom",
      fieldValues: {
        headline: "English heading",
        body: "English body",
        empty: "",
        color: "#123456",
      },
      renderedHtml: "<p>English heading</p>",
    },
  ];
  expect(defaultLocaleGaps(before, "de", definitions)).toEqual([
    "custom/fieldValues.headline",
    "custom/fieldValues.body",
  ]);
  const captured = JSON.parse(
    JSON.stringify({
      op: "setDefaultLocale",
      locale: "de",
      customTextFields: {
        custom: [
          "fieldValues.headline",
          "fieldValues.body",
          "fieldValues.empty",
        ],
      },
    }),
  ) as Operation;
  const after = applyOperations(before, [captured]);
  expect(after.blocks[0]).toMatchObject({
    fieldValues: {
      headline: "English heading",
      body: "English body",
      empty: "",
      color: "#123456",
    },
    renderedHtml: "<p>English heading</p>",
    l10n: {
      en: {
        text: {
          "fieldValues.headline": text("English heading", "English heading"),
          "fieldValues.body": text("English body", "English body"),
        },
      },
    },
  });
  expect(after.blocks[0].l10n?.en.text).not.toHaveProperty("fieldValues.empty");
  expect(after.blocks[0].l10n?.en.text).not.toHaveProperty("fieldValues.color");
  expect(localeCoverage(after, "en", definitions)).toEqual({
    missing: [],
    stale: [],
    translated: ["custom/fieldValues.headline", "custom/fieldValues.body"],
  });
  expect(
    JSON.stringify(
      applyOperations(after, invertOperations(before, [captured])),
    ),
  ).toBe(JSON.stringify(before));
  const edited = applyOperations(after, [
    {
      op: "updateBlock",
      blockId: "custom",
      set: {
        fieldValues: {
          headline: "Deutsche Überschrift",
          body: "Deutscher Text",
          empty: "",
          color: "#123456",
        },
      },
    },
  ]);
  expect(resolveLocale(edited, "en").blocks[0]).toMatchObject({
    fieldValues: { headline: "English heading", body: "English body" },
  });
  expect(localeCoverage(edited, "en", definitions).stale).toEqual([
    "custom/fieldValues.headline",
    "custom/fieldValues.body",
  ]);
});

it.each(
  [
    null,
    [],
    { custom: "fieldValues.headline" },
    { custom: [42] },
    { custom: ["fieldValues.missing"] },
    { custom: ["fieldValues.count"] },
    { custom: ["styles.padding.top"] },
    { custom: ["fieldValues.__proto__"] },
    { custom: ["fieldValues.constructor"] },
    { custom: ["fieldValues.headline.nested"] },
    { absent: ["fieldValues.headline"] },
    { t1: ["content"] },
  ].map((customTextFields) => ({ customTextFields })),
)(
  "refuses malformed custom text metadata without changing content: $customTextFields",
  ({ customTextFields }) => {
    const before = seed();
    before.blocks.push({
      ...createCustomBlock({
        type: "card",
        name: "Card",
        template: "",
        fields: [],
      }),
      id: "custom",
      fieldValues: { headline: "English", count: 2 },
    });
    const original = safeClone(before);
    expect(() =>
      applyOperations(before, [
        {
          ...op,
          customTextFields,
        } as unknown as Operation,
      ]),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_operation", opIndex: 0 }),
    );
    expect(before).toEqual(original);
  },
);

it("does not infer custom text for a block id inherited from Object.prototype", () => {
  const before = seed();
  before.blocks = [
    {
      ...createCustomBlock({
        type: "card",
        name: "Card",
        template: "",
        fields: [],
      }),
      id: "constructor",
      fieldValues: { label: "English" },
    },
  ];
  const after = roundTrip(before);
  expect(after.blocks[0]).toEqual(before.blocks[0]);
});

describe("reserved custom metadata keys", () => {
  const definition: CustomBlockDefinition = {
    type: "card",
    name: "Card",
    template: "",
    fields: [
      { key: "label", label: "Label", type: "text", default: "English" },
    ],
  };
  function customSeed(id: string) {
    const before = seed();
    before.blocks = [{ ...createCustomBlock(definition), id }];
    return before;
  }

  it.each(["__proto__", "constructor", "prototype"])(
    "refuses the own %s metadata key even when that custom block exists",
    (id) => {
      const before = customSeed(id);
      const bytes = JSON.stringify(before);
      const operation = JSON.parse(
        `{"op":"setDefaultLocale","locale":"de","customTextFields":{"${id}":["fieldValues.label"]}}`,
      ) as SetDefaultLocaleOperation;
      expect(Object.hasOwn(operation.customTextFields!, id)).toBe(true);
      expect(() => applyOperationsInPlace(before, [operation])).toThrowError(
        expect.objectContaining({
          code: "invalid_operation",
          opIndex: 0,
          message:
            "customTextFields must map existing custom block ids to lists of string fieldValues paths.",
        }),
      );
      expect(JSON.stringify(before)).toBe(bytes);
    },
  );

  it.each(["__proto__", "constructor", "prototype"])(
    "refuses a non-enumerable own %s metadata key before replay reads it",
    (id) => {
      const before = customSeed(id);
      const bytes = JSON.stringify(before);
      const operation = JSON.parse(
        `{"op":"setDefaultLocale","locale":"de","customTextFields":{"${id}":["fieldValues.label"]}}`,
      ) as SetDefaultLocaleOperation;
      Object.defineProperty(operation.customTextFields!, id, {
        enumerable: false,
      });
      expect(Object.hasOwn(operation.customTextFields!, id)).toBe(true);
      expect(Object.keys(operation.customTextFields!)).toEqual([]);
      expect(() => applyOperationsInPlace(before, [operation])).toThrowError(
        expect.objectContaining({
          code: "invalid_operation",
          opIndex: 0,
          message:
            "customTextFields must map existing custom block ids to lists of string fieldValues paths.",
        }),
      );
      expect(JSON.stringify(before)).toBe(bytes);
    },
  );

  it.each(["__proto__", "constructor", "prototype"])(
    "refuses to capture metadata for the reserved custom block id %s",
    (id) => {
      const before = customSeed(id);
      const bytes = JSON.stringify(before);
      expect(() =>
        createSetDefaultLocaleOperation(before, "de", [definition]),
      ).toThrowError(
        expect.objectContaining({
          code: "invalid_operation",
          opIndex: 0,
          message:
            "customTextFields must map existing custom block ids to lists of string fieldValues paths.",
        }),
      );
      expect(JSON.stringify(before)).toBe(bytes);
    },
  );

  it.each(["__proto__", "constructor", "prototype"])(
    "does not read inherited %s metadata as custom text paths",
    (id) => {
      const before = customSeed(id);
      const customTextFields = Object.create(
        JSON.parse(`{"${id}":["fieldValues.label"]}`),
      );
      expect(Object.hasOwn(customTextFields, id)).toBe(false);
      const after = applyOperations(before, [
        { op: "setDefaultLocale", locale: "de", customTextFields },
      ]);
      expect(after.blocks[0]).toEqual(before.blocks[0]);
    },
  );

  it.each(["__proto__", "constructor", "prototype"])(
    "omits uncaptured text metadata for the reserved custom block id %s",
    (id) => {
      const before = customSeed(id);
      const bytes = JSON.stringify(before);
      const operation = createSetDefaultLocaleOperation(before, "de");
      expect(operation).toEqual({ op: "setDefaultLocale", locale: "de" });
      expect(applyOperations(before, [operation]).blocks[0]).toEqual(
        before.blocks[0],
      );
      expect(JSON.stringify(before)).toBe(bytes);
    },
  );
});

it("preserves a known custom text gap from another language without metadata", () => {
  const before = seed();
  before.blocks = [
    {
      ...createCustomBlock({
        type: "card",
        name: "Card",
        template: "",
        fields: [],
      }),
      id: "custom",
      fieldValues: { headline: "English", variant: "wide" },
      l10n: {
        fr: { text: { "fieldValues.headline": text("Français", "English") } },
      },
    },
  ];
  const after = roundTrip(before);
  expect(after.blocks[0].l10n?.en).toEqual({
    text: { "fieldValues.headline": text("English", "English") },
  });
  expect(after.blocks[0].l10n?.fr).toEqual(before.blocks[0].l10n?.fr);
  const edited = applyOperations(after, [
    {
      op: "updateBlock",
      blockId: "custom",
      set: { fieldValues: { headline: "Deutsch", variant: "wide" } },
    },
  ]);
  expect(resolveLocale(edited, "en").blocks[0]).toMatchObject({
    fieldValues: { headline: "English", variant: "wide" },
  });
});

it.each([
  {
    scenario: "membership",
    locale: "es",
    hidden: false,
    locks: [],
    code: "invalid_operation",
    message: '"es" is not a language version of this template.',
  },
  {
    scenario: "visibility",
    locale: "de",
    hidden: true,
    locks: [],
    code: "invalid_operation",
    message:
      '1 block is hidden in "de". Show it before making it the default.',
  },
  {
    scenario: "lock",
    locale: "de",
    hidden: false,
    locks: [{ blockId: "t1", sessionId: "other" }],
    code: "locked_by_others",
    message: "Other sessions hold locks on this template.",
  },
])(
  "checks existing $scenario refusals before malformed custom metadata",
  ({ locale, hidden, locks, code, message }) => {
    const before = seed();
    if (hidden) before.blocks[0].l10n!.de.hidden = true;
    const original = safeClone(before);
    expect(() =>
      applyOperations(
        before,
        [
          {
            op: "setDefaultLocale",
            locale,
            customTextFields: null,
          } as unknown as Operation,
        ],
        { locks },
      ),
    ).toThrowError(expect.objectContaining({ code, message, opIndex: 0 }));
    expect(before).toEqual(original);
  },
);

it("skips empty defaults, as coverage does, so the gap list can reach []", () => {
  const before = seed();
  before.blocks.push(createImageBlock({ id: "empty", alt: "" }));
  expect(defaultLocaleGaps(before, "de")).toEqual([]);
  expect(localeCoverage(before, "de").missing).toEqual([]);
  expect(roundTrip(before).blocks[1]).not.toHaveProperty("l10n");
  before.blocks.push(createImageBlock({ id: "decorative", alt: "Photo" }));
  expect(defaultLocaleGaps(before, "de")).toEqual(["decorative/alt"]);
});

function removedParentFixture(name: string): TemplateContent {
  return JSON.parse(
    readFileSync(
      join(import.meta.dirname, "fixtures/operations", name),
      "utf8",
    ),
  ).content;
}

it.each([
  "locale-default-removed-parent.json",
  "locale-default-removed-nested-parent.json",
])(
  "preserves the prior French projection when promoting a removed parent: %s",
  (name) => {
    const before = removedParentFixture(name);
    const french = resolveLocale(before, "fr").blocks[0];
    const after = roundTrip(before);
    expect(resolveLocale(after, "fr").blocks[0]).toEqual(french);
    expect(
      JSON.stringify(applyOperations(after, invertOperations(before, [op]))),
    ).toBe(JSON.stringify(before));
    const root = name.includes("nested") ? "wrapper" : "backgroundImage";
    expect(Object.keys(after.blocks[0].l10n!.fr.set!).sort()).toEqual(
      [root, "styles.backgroundColor"].sort(),
    );
  },
);

it("keeps the old default's restored parent free of unreachable overlapping overrides", () => {
  const before = removedParentFixture("locale-default-removed-parent.json");
  before.blocks[0].l10n!.de.set!["backgroundImage.position.x"] = "right";
  const after = roundTrip(before);
  expect(after.blocks[0].l10n!.en.set).toEqual({
    backgroundImage: {
      url: "https://example.com/en.png",
      size: "cover",
      position: { x: "center", y: "center" },
      repeat: false,
    },
  });
});
