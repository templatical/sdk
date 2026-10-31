import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyOperations,
  resolveLocale,
  invertOperations,
  defaultLocaleGaps,
  localeCoverage,
  createDefaultTemplateContent,
  createTitleBlock,
  createImageBlock,
  createCustomBlock,
  createMenuBlock,
  sourceHash,
  safeClone,
  type Operation,
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
  it("keeps gaps at the former base without an old-default entry", () => {
    const before = seed();
    before.blocks.push(createTitleBlock({ id: "gap", content: "Missing" }));
    expect(roundTrip(before).blocks[1]).toEqual(before.blocks[1]);
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

it("still leaves no old-default entry for a gap field the new default had no text for", () => {
  const before = seed();
  before.blocks.push(createTitleBlock({ id: "gap", content: "Gap" }));
  const after = roundTrip(before);
  expect(after.blocks[1]).not.toHaveProperty("l10n");
  expect(localeCoverage(after, "en").missing).toEqual(["gap/content"]);
});

it("skips empty defaults, as coverage does, so the gap list can reach []", () => {
  const before = seed();
  before.blocks.push(createImageBlock({ id: "empty", alt: "" }));
  expect(defaultLocaleGaps(before, "de")).toEqual([]);
  expect(localeCoverage(before, "de").missing).toEqual([]);
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
