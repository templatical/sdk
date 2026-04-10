import { describe, expect, it } from "vitest";
import {
  deepMergeDefaults,
  DEFAULT_BLOCK_DEFAULTS,
  DEFAULT_TEMPLATE_DEFAULTS,
  TITLE_BLOCK_DEFAULTS,
  PARAGRAPH_BLOCK_DEFAULTS,
  IMAGE_BLOCK_DEFAULTS,
  BUTTON_BLOCK_DEFAULTS,
  DIVIDER_BLOCK_DEFAULTS,
  SECTION_BLOCK_DEFAULTS,
  VIDEO_BLOCK_DEFAULTS,
  SOCIAL_ICONS_BLOCK_DEFAULTS,
  SPACER_BLOCK_DEFAULTS,
  HTML_BLOCK_DEFAULTS,
  MENU_BLOCK_DEFAULTS,
  TABLE_BLOCK_DEFAULTS,
  COUNTDOWN_BLOCK_DEFAULTS,
} from "../src/defaults";
import {
  createTitleBlock,
  createParagraphBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
  createSectionBlock,
  createVideoBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createHtmlBlock,
  createMenuBlock,
  createTableBlock,
  createCountdownBlock,
} from "../src/factory";
import { createDefaultTemplateContent } from "../src/template";

describe("deepMergeDefaults", () => {
  it("returns base when overrides is empty", () => {
    const base = { a: 1, b: "hello" };
    const result = deepMergeDefaults(base, {});
    expect(result).toEqual({ a: 1, b: "hello" });
  });

  it("overrides shallow primitives", () => {
    const base = { a: 1, b: "hello", c: true };
    const result = deepMergeDefaults(base, { a: 42, b: "world" });
    expect(result.a).toBe(42);
    expect(result.b).toBe("world");
    expect(result.c).toBe(true);
  });

  it("deep merges nested objects", () => {
    const base = {
      styles: { padding: { top: 10, right: 10, bottom: 10, left: 10 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    };
    const result = deepMergeDefaults(base, {
      styles: { padding: { top: 20 } },
    } as Partial<typeof base>);
    expect(result.styles.padding.top).toBe(20);
    expect(result.styles.padding.right).toBe(10);
    expect(result.styles.padding.bottom).toBe(10);
    expect(result.styles.padding.left).toBe(10);
    expect(result.styles.margin.top).toBe(0);
  });

  it("replaces arrays instead of merging", () => {
    const base = { items: [1, 2, 3], name: "test" };
    const result = deepMergeDefaults(base, { items: [4, 5] });
    expect(result.items).toEqual([4, 5]);
    expect(result.name).toBe("test");
  });

  it("does not mutate the base object", () => {
    const base = {
      styles: { padding: { top: 10, right: 10, bottom: 10, left: 10 } },
    };
    const baseCopy = JSON.parse(JSON.stringify(base));
    deepMergeDefaults(base, {
      styles: { padding: { top: 99 } },
    } as Partial<typeof base>);
    expect(base).toEqual(baseCopy);
  });

  it("does not mutate the overrides object", () => {
    const base = { a: 1, b: { c: 2 } };
    const overrides = { b: { c: 5 } } as Partial<typeof base>;
    const overridesCopy = JSON.parse(JSON.stringify(overrides));
    deepMergeDefaults(base, overrides);
    expect(overrides).toEqual(overridesCopy);
  });

  it("skips undefined override values", () => {
    const base = { a: 1, b: 2 };
    const result = deepMergeDefaults(base, { a: undefined });
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
  });

  it("allows null to override a value", () => {
    const base = { a: "hello" as string | null };
    const result = deepMergeDefaults(base, { a: null });
    expect(result.a).toBeNull();
  });

  it("handles deeply nested objects (3+ levels)", () => {
    const base = {
      level1: {
        level2: {
          level3: { value: "original", other: "keep" },
        },
      },
    };
    const result = deepMergeDefaults(base, {
      level1: { level2: { level3: { value: "changed" } } },
    } as Partial<typeof base>);
    expect(result.level1.level2.level3.value).toBe("changed");
    expect(result.level1.level2.level3.other).toBe("keep");
  });

  it("replaces object with primitive when override is primitive", () => {
    const base = { a: { nested: true } as unknown };
    const result = deepMergeDefaults(base, { a: "flat" });
    expect(result.a).toBe("flat");
  });

  it("replaces primitive with object when override is object", () => {
    const base = { a: "flat" as unknown };
    const result = deepMergeDefaults(base, { a: { nested: true } });
    expect(result.a).toEqual({ nested: true });
  });

  it("handles empty nested objects", () => {
    const base = { styles: { padding: { top: 10 } } };
    const result = deepMergeDefaults(base, { styles: {} } as Partial<typeof base>);
    expect(result.styles.padding.top).toBe(10);
  });
});

describe("DEFAULT_BLOCK_DEFAULTS", () => {
  const expectedKeys = [
    "title",
    "paragraph",
    "image",
    "button",
    "divider",
    "section",
    "video",
    "social",
    "spacer",
    "html",
    "menu",
    "table",
    "countdown",
  ];

  it("contains all 13 block type keys", () => {
    expect(Object.keys(DEFAULT_BLOCK_DEFAULTS).sort()).toEqual(
      expectedKeys.sort(),
    );
  });

  it("maps per-block constants correctly", () => {
    expect(DEFAULT_BLOCK_DEFAULTS.title).toBe(TITLE_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.paragraph).toBe(PARAGRAPH_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.image).toBe(IMAGE_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.button).toBe(BUTTON_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.divider).toBe(DIVIDER_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.section).toBe(SECTION_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.video).toBe(VIDEO_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.social).toBe(SOCIAL_ICONS_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.spacer).toBe(SPACER_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.html).toBe(HTML_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.menu).toBe(MENU_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.table).toBe(TABLE_BLOCK_DEFAULTS);
    expect(DEFAULT_BLOCK_DEFAULTS.countdown).toBe(COUNTDOWN_BLOCK_DEFAULTS);
  });
});

describe("DEFAULT_TEMPLATE_DEFAULTS", () => {
  it("has expected values", () => {
    expect(DEFAULT_TEMPLATE_DEFAULTS.width).toBe(600);
    expect(DEFAULT_TEMPLATE_DEFAULTS.backgroundColor).toBe("#ffffff");
    expect(DEFAULT_TEMPLATE_DEFAULTS.fontFamily).toBe("Arial");
  });

  it("matches createDefaultTemplateContent output", () => {
    const content = createDefaultTemplateContent();
    expect(content.settings.width).toBe(DEFAULT_TEMPLATE_DEFAULTS.width);
    expect(content.settings.backgroundColor).toBe(
      DEFAULT_TEMPLATE_DEFAULTS.backgroundColor,
    );
    expect(content.settings.fontFamily).toBe(
      DEFAULT_TEMPLATE_DEFAULTS.fontFamily,
    );
  });
});

describe("per-block constants match factory output", () => {
  function stripMeta(block: Record<string, unknown>) {
    const { id, type, styles, ...rest } = block;
    return rest;
  }

  it("TITLE_BLOCK_DEFAULTS matches createTitleBlock", () => {
    const block = createTitleBlock();
    expect(stripMeta(block)).toEqual(TITLE_BLOCK_DEFAULTS);
  });

  it("PARAGRAPH_BLOCK_DEFAULTS matches createParagraphBlock", () => {
    const block = createParagraphBlock();
    expect(stripMeta(block)).toEqual(PARAGRAPH_BLOCK_DEFAULTS);
  });

  it("IMAGE_BLOCK_DEFAULTS matches createImageBlock", () => {
    const block = createImageBlock();
    expect(stripMeta(block)).toEqual(IMAGE_BLOCK_DEFAULTS);
  });

  it("BUTTON_BLOCK_DEFAULTS matches createButtonBlock", () => {
    const block = createButtonBlock();
    expect(stripMeta(block)).toEqual(BUTTON_BLOCK_DEFAULTS);
  });

  it("DIVIDER_BLOCK_DEFAULTS matches createDividerBlock", () => {
    const block = createDividerBlock();
    expect(stripMeta(block)).toEqual(DIVIDER_BLOCK_DEFAULTS);
  });

  it("SECTION_BLOCK_DEFAULTS matches createSectionBlock", () => {
    const block = createSectionBlock();
    const { id, type, styles, children, ...rest } = block;
    expect(rest).toEqual(SECTION_BLOCK_DEFAULTS);
  });

  it("VIDEO_BLOCK_DEFAULTS matches createVideoBlock", () => {
    const block = createVideoBlock();
    expect(stripMeta(block)).toEqual(VIDEO_BLOCK_DEFAULTS);
  });

  it("SOCIAL_ICONS_BLOCK_DEFAULTS matches createSocialIconsBlock", () => {
    const block = createSocialIconsBlock();
    const { id, type, styles, icons, ...rest } = block;
    expect(rest).toEqual(SOCIAL_ICONS_BLOCK_DEFAULTS);
  });

  it("SPACER_BLOCK_DEFAULTS matches createSpacerBlock", () => {
    const block = createSpacerBlock();
    expect(stripMeta(block)).toEqual(SPACER_BLOCK_DEFAULTS);
  });

  it("HTML_BLOCK_DEFAULTS matches createHtmlBlock", () => {
    const block = createHtmlBlock();
    expect(stripMeta(block)).toEqual(HTML_BLOCK_DEFAULTS);
  });

  it("MENU_BLOCK_DEFAULTS matches createMenuBlock", () => {
    const block = createMenuBlock();
    const { id, type, styles, items, ...rest } = block;
    expect(rest).toEqual(MENU_BLOCK_DEFAULTS);
  });

  it("TABLE_BLOCK_DEFAULTS matches createTableBlock", () => {
    const block = createTableBlock();
    const { id, type, styles, rows, ...rest } = block;
    expect(rest).toEqual(TABLE_BLOCK_DEFAULTS);
  });

  it("COUNTDOWN_BLOCK_DEFAULTS matches createCountdownBlock", () => {
    const block = createCountdownBlock();
    expect(stripMeta(block)).toEqual(COUNTDOWN_BLOCK_DEFAULTS);
  });
});

describe("default constants are not mutated by factories", () => {
  it("TITLE_BLOCK_DEFAULTS is unchanged after creating a block with overrides", () => {
    const before = JSON.parse(JSON.stringify(TITLE_BLOCK_DEFAULTS));
    createTitleBlock({ level: 4 });
    expect(TITLE_BLOCK_DEFAULTS).toEqual(before);
  });

  it("PARAGRAPH_BLOCK_DEFAULTS is unchanged after creating a block with overrides", () => {
    const before = JSON.parse(JSON.stringify(PARAGRAPH_BLOCK_DEFAULTS));
    createParagraphBlock({ content: '<p>Override</p>' });
    expect(PARAGRAPH_BLOCK_DEFAULTS).toEqual(before);
  });

  it("BUTTON_BLOCK_DEFAULTS is unchanged after creating a block with overrides", () => {
    const before = JSON.parse(JSON.stringify(BUTTON_BLOCK_DEFAULTS));
    createButtonBlock({ backgroundColor: "#000" });
    expect(BUTTON_BLOCK_DEFAULTS).toEqual(before);
  });

  it("DEFAULT_TEMPLATE_DEFAULTS is unchanged after creating content with overrides", () => {
    const before = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_DEFAULTS));
    createDefaultTemplateContent("Helvetica", { width: 800 });
    expect(DEFAULT_TEMPLATE_DEFAULTS).toEqual(before);
  });
});
