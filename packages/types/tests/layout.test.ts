import { describe, expect, it } from "vitest";
import {
  applyLayout,
  assertNoSlotInContent,
  assertNoWrapperInContent,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createTitleBlock,
  createWrapperBlock,
  isSection,
  isSlot,
  isWrapper,
  layoutWrapsSlot,
  validateLayout,
  type Block,
  type ParagraphBlock,
  type TemplateContent,
  type TitleBlock,
  type WrapperBlock,
} from "../src";

const EXACTLY_ONE_SLOT =
  "[Templatical] layout: must contain exactly one slot block";
const SLOT_NESTED_IN_SECTION =
  "[Templatical] layout: slot must be a top-level or wrapper child, not nested in a section";
const WRAPPER_IN_WRAPPER =
  "[Templatical] layout: a wrapper cannot contain a wrapper";
const NESTED_MJ_WRAPPER =
  "[Templatical] layout: a wrapper around the slot cannot contain blocks that emit mj-wrapper (section.wrapper)";
const SLOT_IN_CONTENT = "[Templatical] slot is not a valid content block";
const WRAPPER_IN_CONTENT = "[Templatical] wrapper is not a valid content block";

function withBlocks(
  blocks: Block[],
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  if (settings) {
    content.settings = { ...content.settings, ...settings };
  }
  return content;
}

function siblingLayout(
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  return withBlocks(
    [
      createTitleBlock({ content: "<p>View in browser</p>" }),
      createSlotBlock(),
      createParagraphBlock({ content: "<p>Impressum</p>" }),
    ],
    settings,
  );
}

function cardLayout(
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  return withBlocks(
    [
      createTitleBlock({ content: "<p>View in browser</p>" }),
      createWrapperBlock({
        styles: {
          backgroundColor: "#ffffff",
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
        children: [createSlotBlock()],
      }),
      createParagraphBlock({ content: "<p>Impressum</p>" }),
    ],
    settings,
  );
}

function freeze(value: unknown): string {
  return JSON.stringify(value);
}

describe("validateLayout", () => {
  it("throws when the layout has no slot", () => {
    const layout = withBlocks([
      createTitleBlock({ content: "<p>Header only</p>" }),
    ]);
    expect(() => validateLayout(layout)).toThrow(EXACTLY_ONE_SLOT);
  });

  it("throws when the layout has two top-level slots", () => {
    const layout = withBlocks([createSlotBlock(), createSlotBlock()]);
    expect(() => validateLayout(layout)).toThrow(EXACTLY_ONE_SLOT);
  });

  it("throws when the layout has two slots, one inside a wrapper", () => {
    const layout = withBlocks([
      createSlotBlock(),
      createWrapperBlock({ children: [createSlotBlock()] }),
    ]);
    expect(() => validateLayout(layout)).toThrow(EXACTLY_ONE_SLOT);
  });

  it("throws when the slot sits in a section column", () => {
    const layout = withBlocks([
      createSectionBlock({ children: [[createSlotBlock()]] }),
    ]);
    expect(() => validateLayout(layout)).toThrow(SLOT_NESTED_IN_SECTION);
  });

  it("throws when a wrapper contains a wrapper", () => {
    const layout = withBlocks([
      createWrapperBlock({
        children: [createWrapperBlock({ children: [createSlotBlock()] })],
      }),
    ]);
    expect(() => validateLayout(layout)).toThrow(WRAPPER_IN_WRAPPER);
  });

  it("accepts a top-level header / slot / footer layout", () => {
    const layout = siblingLayout();
    validateLayout(layout);
    expect(layout.blocks.map((block) => block.type)).toEqual([
      "title",
      "slot",
      "paragraph",
    ]);
  });

  it("accepts a wrapper whose children are the slot", () => {
    const layout = withBlocks([
      createWrapperBlock({ children: [createSlotBlock()] }),
    ]);
    validateLayout(layout);
    expect(layout.blocks).toHaveLength(1);
    expect(layout.blocks[0]?.type).toBe("wrapper");
    const card = layout.blocks[0] as WrapperBlock;
    expect(card.children.map((child) => child.type)).toEqual(["slot"]);
  });
});

describe("layoutWrapsSlot", () => {
  it("is false when the slot is a top-level sibling", () => {
    expect(layoutWrapsSlot(siblingLayout())).toBe(false);
  });

  it("is true when the slot is a direct wrapper child", () => {
    expect(layoutWrapsSlot(cardLayout())).toBe(true);
  });
});

describe("assertNoSlotInContent", () => {
  it("throws when content has a top-level slot", () => {
    const content = withBlocks([createSlotBlock()]);
    expect(() => assertNoSlotInContent(content)).toThrow(SLOT_IN_CONTENT);
  });

  it("throws when content has a slot nested in a section column", () => {
    const content = withBlocks([
      createSectionBlock({ children: [[createSlotBlock()]] }),
    ]);
    expect(() => assertNoSlotInContent(content)).toThrow(SLOT_IN_CONTENT);
  });
});

describe("assertNoWrapperInContent", () => {
  it("throws when content has a top-level wrapper", () => {
    const content = withBlocks([createWrapperBlock()]);
    expect(() => assertNoWrapperInContent(content)).toThrow(WRAPPER_IN_CONTENT);
  });

  it("throws when content has a wrapper nested in a section column", () => {
    const content = withBlocks([
      createSectionBlock({ children: [[createWrapperBlock()]] }),
    ]);
    expect(() => assertNoWrapperInContent(content)).toThrow(WRAPPER_IN_CONTENT);
  });
});

describe("applyLayout", () => {
  it("splices authored blocks in place of a sibling slot and merges settings", () => {
    const layout = siblingLayout({ backgroundColor: "#f3f4f6" });
    const header = layout.blocks[0] as TitleBlock;
    const footer = layout.blocks[2] as ParagraphBlock;
    const author = createParagraphBlock({ content: "<p>Hello author</p>" });
    const content = withBlocks([author], {
      width: 640,
      fontFamily: "Georgia",
      direction: "rtl",
      backgroundColor: "#111111",
      textColor: "#222222",
      locale: "de",
    });
    const layoutBefore = freeze(layout);
    const contentBefore = freeze(content);

    const result = applyLayout(layout, content);

    expect(result.blocks).toHaveLength(3);
    expect(result.blocks.map((block) => block.type)).toEqual([
      "title",
      "paragraph",
      "paragraph",
    ]);
    expect((result.blocks[0] as TitleBlock).content).toBe(
      "<p>View in browser</p>",
    );
    expect(result.blocks[0]?.id).not.toBe(header.id);
    expect(result.blocks[1]?.id).toBe(author.id);
    expect((result.blocks[1] as ParagraphBlock).content).toBe(
      "<p>Hello author</p>",
    );
    expect((result.blocks[2] as ParagraphBlock).content).toBe("<p>Impressum</p>");
    expect(result.blocks[2]?.id).not.toBe(footer.id);
    expect(result.blocks.some(isSlot)).toBe(false);
    expect(result.settings.backgroundColor).toBe("#f3f4f6");
    expect(result.settings.width).toBe(640);
    expect(result.settings.fontFamily).toBe("Georgia");
    expect(result.settings.direction).toBe("rtl");
    expect(result.settings.textColor).toBe("#222222");
    expect(result.settings.locale).toBe("de");
    expect(freeze(layout)).toBe(layoutBefore);
    expect(freeze(content)).toBe(contentBefore);
    expect(result.blocks).not.toBe(layout.blocks);
    expect(result.blocks).not.toBe(content.blocks);
    expect(content.settings.backgroundColor).toBe("#111111");
  });

  it("splices authored blocks into a card wrapper and remints the wrapper id", () => {
    const layout = cardLayout({ backgroundColor: "#f3f4f6" });
    const wrapper = layout.blocks[1] as WrapperBlock;
    const authorTitle = createTitleBlock({ content: "<p>Author title</p>" });
    const authorBody = createParagraphBlock({ content: "<p>Author body</p>" });
    const content = withBlocks([authorTitle, authorBody]);
    const layoutBefore = freeze(layout);
    const contentBefore = freeze(content);

    const result = applyLayout(layout, content);

    expect(result.blocks.map((block) => block.type)).toEqual([
      "title",
      "wrapper",
      "paragraph",
    ]);
    const card = result.blocks[1] as WrapperBlock;
    expect(isWrapper(card)).toBe(true);
    expect(card.id).not.toBe(wrapper.id);
    expect(card.children.map((child) => child.id)).toEqual([
      authorTitle.id,
      authorBody.id,
    ]);
    expect(card.children[0]).not.toBe(authorTitle);
    expect((card.children[0] as TitleBlock).content).toBe("<p>Author title</p>");
    expect((card.children[1] as ParagraphBlock).content).toBe(
      "<p>Author body</p>",
    );
    expect(card.children.some(isSlot)).toBe(false);
    expect(result.blocks.some(isSlot)).toBe(false);
    expect(result.settings.backgroundColor).toBe("#f3f4f6");
    expect(freeze(layout)).toBe(layoutBefore);
    expect(freeze(content)).toBe(contentBefore);
  });

  it("throws when a card layout would nest section.wrapper inside the slot wrapper", () => {
    const layout = cardLayout();
    const content = withBlocks([
      createSectionBlock({ wrapper: { backgroundColor: "#fff" } }),
    ]);
    const layoutBefore = freeze(layout);
    const contentBefore = freeze(content);

    expect(() => applyLayout(layout, content)).toThrow(NESTED_MJ_WRAPPER);
    expect(freeze(layout)).toBe(layoutBefore);
    expect(freeze(content)).toBe(contentBefore);
  });

  it("keeps author section.wrapper when the slot is a top-level sibling", () => {
    const layout = siblingLayout();
    const section = createSectionBlock({
      wrapper: { backgroundColor: "#fff" },
    });
    const content = withBlocks([section]);

    const result = applyLayout(layout, content);

    const author = result.blocks.find((block) => block.id === section.id);
    expect(author?.type).toBe("section");
    expect(isSection(author!) ? author.wrapper : undefined).toEqual({
      backgroundColor: "#fff",
    });
  });
});
