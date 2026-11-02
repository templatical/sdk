import { describe, expect, it } from "vitest";
import {
  applyOperations,
  defaultLocaleGaps,
  localeHiddenBlocks,
  safeClone,
  type Operation,
  type TemplateContent,
} from "../src";
const before = {
  blocks: [
    {
      id: "wrap",
      type: "wrapper",
      children: [
        {
          id: "first",
          type: "title",
          content: "Hello",
          l10n: { de: { hidden: true } },
        },
        {
          id: "section",
          type: "section",
          columns: "1",
          l10n: { de: { hidden: true } },
          children: [
            [
              {
                id: "nested",
                type: "title",
                content: "Nested",
                l10n: { de: { hidden: true } },
              },
            ],
          ],
        },
        {
          id: "last",
          type: "title",
          content: "Last",
          l10n: {
            de: {
              text: { content: { value: "Letzte", sourceHash: "00000000" } },
            },
          },
        },
      ],
    },
  ],
  settings: { locale: "en", locales: ["de"] },
} as unknown as TemplateContent;
describe("localeHiddenBlocks", () => {
  it("returns depth-first hidden ids inside wrappers and section columns without mutation", () => {
    const original = safeClone(before);
    expect(localeHiddenBlocks(before, "de")).toEqual([
      "first",
      "section",
      "nested",
    ]);
    expect(before).toEqual(original);
  });
  it.each(["en", "es"])("returns no hidden blocks for %s", (locale) =>
    expect(localeHiddenBlocks(before, locale)).toEqual([]),
  );
  it("rebases wrapper descendants and counts their gaps", () => {
    const content = safeClone(before);
    const wrapper = content.blocks[0];
    if (wrapper.type !== "wrapper") throw new Error("Expected wrapper");
    delete wrapper.children[0].l10n;
    delete wrapper.children[1].l10n;
    const section = wrapper.children[1];
    if (section.type === "section") delete section.children[0][0].l10n;
    expect(defaultLocaleGaps(content, "de")).toEqual([
      "first/content",
      "nested/content",
    ]);
    expect(
      applyOperations(content, [
        { op: "setDefaultLocale", locale: "de" } as Operation,
      ]).blocks[0],
    ).toMatchObject({
      children: [{ content: "Hello" }, {}, { content: "Letzte" }],
    });
  });
});

describe("hiding a layout's slot", () => {
  const layout = {
    blocks: [
      { id: "logo", type: "title", content: "Brand" },
      {
        id: "card",
        type: "wrapper",
        children: [
          { id: "slot", type: "slot" },
          { id: "footer", type: "title", content: "Footer" },
        ],
      },
    ],
    settings: { locale: "en", locales: ["de"] },
  } as unknown as TemplateContent;
  const hide = (blockId: string, hidden = true): Operation => ({
    op: "updateBlockLocale",
    blockId,
    locale: "de",
    hidden,
  });

  it.each(["slot", "card"])("refuses hidden: true on %s", (blockId) => {
    const original = safeClone(layout);
    expect(() => applyOperations(layout, [hide(blockId)])).toThrowError(
      expect.objectContaining({
        code: "invalid_operation",
        opIndex: 0,
        blockId,
        message:
          "A layout's slot block, and any block that contains it, can't be hidden.",
      }),
    );
    expect(layout).toEqual(original);
  });

  it.each(["logo", "footer"])(
    "still hides the ordinary layout block %s",
    (blockId) => {
      const after = applyOperations(layout, [hide(blockId)]);
      expect(localeHiddenBlocks(after, "de")).toEqual([blockId]);
    },
  );

  it("still accepts hidden: false on the slot", () => {
    expect(applyOperations(layout, [hide("slot", false)])).toEqual(layout);
  });
});

describe("placing a layout's slot under a block a language hides", () => {
  const message =
    "A layout's slot block can't be placed inside a block that a language hides.";
  function layout(wrapped = false): TemplateContent {
    const slot = { id: "slot", type: "slot" };
    return {
      blocks: [
        wrapped ? { id: "card", type: "wrapper", children: [slot] } : slot,
        {
          id: "hidden",
          type: "section",
          columns: "1",
          children: [[{ id: "p", type: "title", content: "P" }]],
          l10n: { de: { hidden: true } },
        },
        { id: "open", type: "section", columns: "1", children: [[]] },
      ],
      settings: { locale: "en", locales: ["de"] },
    } as unknown as TemplateContent;
  }
  const move = (blockId: string, sectionId: string | null): Operation => ({
    op: "moveBlock",
    blockId,
    parent: sectionId === null ? null : { sectionId, column: 0 },
    after: null,
  });

  it.each([
    ["the slot", false, "slot"],
    ["a wrapper holding the slot", true, "card"],
  ] as const)(
    "refuses moving %s into a section hidden in a language",
    (_name, wrapped, blockId) => {
      const before = layout(wrapped);
      const original = safeClone(before);
      expect(() =>
        applyOperations(before, [move(blockId, "hidden")]),
      ).toThrowError(
        expect.objectContaining({
          code: "invalid_operation",
          opIndex: 0,
          blockId,
          message,
        }),
      );
      expect(before).toEqual(original);
    },
  );

  it("still moves the slot into a visible section and along the top level", () => {
    const into = applyOperations(layout(), [move("slot", "open")]);
    expect(into.blocks.map((block) => block.id)).toEqual(["hidden", "open"]);
    const along = applyOperations(layout(), [
      { op: "moveBlock", blockId: "slot", parent: null, after: "open" },
    ]);
    expect(along.blocks.map((block) => block.id)).toEqual([
      "hidden",
      "open",
      "slot",
    ]);
  });

  it("refuses adding the slot into a hidden section, or inside a block hidden in a language", () => {
    const before = layout();
    before.blocks.shift();
    for (const [block, sectionId] of [
      [{ id: "slot", type: "slot" }, "hidden"],
      [
        {
          id: "card",
          type: "wrapper",
          children: [{ id: "slot", type: "slot" }],
          l10n: { de: { hidden: true } },
        },
        null,
      ],
    ] as const)
      expect(() =>
        applyOperations(before, [
          {
            op: "addBlock",
            block: block as never,
            parent: sectionId === null ? null : { sectionId, column: 0 },
            after: null,
          },
        ]),
      ).toThrowError(
        expect.objectContaining({
          code: "invalid_operation",
          blockId: block.id,
          message,
        }),
      );
  });
});
