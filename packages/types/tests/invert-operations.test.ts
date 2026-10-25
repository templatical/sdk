import { describe, expect, it } from "vitest";
import type { Block, Operation, TemplateContent } from "../src";
import { applyOperations, invertOperations, OperationError } from "../src";

const leaf = (id: string, extra: Record<string, unknown> = {}): Block =>
  ({
    id,
    type: "paragraph",
    content: `<p>${id}</p>`,
    ...extra,
  }) as unknown as Block;
const section = (id: string, columns: string, children: Block[][]): Block =>
  ({ id, type: "section", columns, children }) as unknown as Block;
const content = (
  blocks: Block[],
  settings: Record<string, unknown> = { width: 600 },
): TemplateContent => ({ blocks, settings }) as unknown as TemplateContent;

function refusal(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof OperationError ? error.code : String(error);
  }
}

describe("invertOperations", () => {
  const base = content([
    leaf("a"),
    section("s", "2", [[leaf("b")], []]),
    leaf("c"),
  ]);

  it("inverts addBlock into a deleteBlock that expects the added block", () => {
    const ops: Operation[] = [
      { op: "addBlock", block: leaf("n"), parent: null, after: "a" },
    ];

    expect(invertOperations(base, ops)).toEqual([
      { op: "deleteBlock", blockId: "n", expect: { block: leaf("n") } },
    ]);
  });

  it("inverts deleteBlock into addBlock at the original parent and sibling", () => {
    const ops: Operation[] = [{ op: "deleteBlock", blockId: "b" }];

    expect(invertOperations(base, ops)).toEqual([
      {
        op: "addBlock",
        block: leaf("b"),
        parent: { sectionId: "s", column: 0 },
        after: null,
      },
    ]);
  });

  it("inverts moveBlock into a move back that expects the moved position", () => {
    const ops: Operation[] = [
      {
        op: "moveBlock",
        blockId: "c",
        parent: { sectionId: "s", column: 1 },
        after: null,
      },
    ];

    expect(invertOperations(base, ops)).toEqual([
      {
        op: "moveBlock",
        blockId: "c",
        parent: null,
        after: "s",
        expect: { parent: { sectionId: "s", column: 1 }, after: null },
      },
    ]);
  });

  it("inverts updateBlock by restoring old values and unsetting new keys, expecting the new values", () => {
    const before = content([leaf("a", { color: "#000" })]);
    const ops: Operation[] = [
      {
        op: "updateBlock",
        blockId: "a",
        set: { content: "<p>x</p>", align: "left" },
        unset: ["color"],
      },
    ];

    expect(invertOperations(before, ops)).toEqual([
      {
        op: "updateBlock",
        blockId: "a",
        set: { content: "<p>a</p>", color: "#000" },
        unset: ["align"],
        expect: { content: "<p>x</p>", align: "left", color: null },
      },
    ]);
  });

  it("inverts updateSettings the same way", () => {
    const before = content([], { width: 600 });
    const ops: Operation[] = [
      { op: "updateSettings", set: { width: 640, linkColor: "#00f" } },
    ];

    expect(invertOperations(before, ops)).toEqual([
      {
        op: "updateSettings",
        set: { width: 600 },
        unset: ["linkColor"],
        expect: { width: 640, linkColor: "#00f" },
      },
    ]);
  });

  it("inverts setContent into setContent with the previous content", () => {
    const ops: Operation[] = [{ op: "setContent", content: content([]) }];

    expect(invertOperations(base, ops)).toEqual([
      { op: "setContent", content: JSON.parse(JSON.stringify(base)) },
    ]);
  });

  it("returns the inverses in reverse order, each against the content before its operation", () => {
    const ops: Operation[] = [
      { op: "addBlock", block: leaf("n"), parent: null, after: null },
      { op: "moveBlock", blockId: "n", parent: null, after: "c" },
    ];

    const inverse = invertOperations(base, ops);

    expect(inverse.map((op) => op.op)).toEqual(["moveBlock", "deleteBlock"]);
    expect(applyOperations(applyOperations(base, ops), inverse)).toEqual(base);
  });

  it("is refused once someone else has changed what the inverse expects", () => {
    const ops: Operation[] = [
      { op: "updateBlock", blockId: "a", set: { content: "<p>mine</p>" } },
    ];
    const mine = applyOperations(base, ops);
    const theirs = applyOperations(mine, [
      { op: "updateBlock", blockId: "a", set: { content: "<p>theirs</p>" } },
    ]);

    expect(
      refusal(() => applyOperations(theirs, invertOperations(base, ops))),
    ).toBe("precondition_failed");
  });

  it("is refused when the sibling a deletion's inverse anchors to is gone", () => {
    const ops: Operation[] = [{ op: "deleteBlock", blockId: "c" }];
    const later = applyOperations(applyOperations(base, ops), [
      { op: "deleteBlock", blockId: "s" },
    ]);

    expect(
      refusal(() => applyOperations(later, invertOperations(base, ops))),
    ).toBe("anchor_missing");
  });

  it("throws the engine's error, with the operation's index, for operations that don't apply", () => {
    const missing = (() => {
      try {
        invertOperations(base, [
          { op: "updateBlock", blockId: "a", set: { content: "x" } },
          { op: "deleteBlock", blockId: "zz" },
        ]);
      } catch (error) {
        return error;
      }
    })() as OperationError;
    const anchor = (() => {
      try {
        invertOperations(base, [
          { op: "updateBlock", blockId: "a", set: { content: "x" } },
          { op: "addBlock", block: leaf("n"), parent: null, after: "zz" },
        ]);
      } catch (error) {
        return error;
      }
    })() as OperationError;

    expect(missing).toBeInstanceOf(OperationError);
    expect([missing.code, missing.opIndex]).toEqual(["block_missing", 1]);
    expect(anchor).toBeInstanceOf(OperationError);
    expect([anchor.code, anchor.opIndex]).toEqual(["anchor_missing", 1]);
  });
});

describe("locale operation inverses", () => {
  const translated = { value: "Hallo", source: "67eb44ba" };
  const base = content(
    [
      { id: "t1", type: "title", content: "Hi" } as Block,
      section("s1", "1", [
        [
          {
            id: "m1",
            type: "menu",
            items: [
              { id: "i1", text: "Shop", url: "https://example.com/shop" },
            ],
          } as Block,
        ],
      ]),
    ],
    {
      width: 600,
      backgroundColor: "#ffffff",
      locale: "en",
      preheaderText: "Hello there",
      direction: "ltr",
      locales: ["de", "fr"],
    },
  );
  const withLayers = (): TemplateContent => {
    const before = structuredClone(base);
    before.blocks[0].l10n = {
      de: {
        text: { content: translated },
        set: { color: "red" },
        hidden: true,
      },
    };
    const nested = (before.blocks[1] as { children: Block[][] }).children[0][0];
    nested.l10n = {
      de: { text: { "items.i1.text": { value: "Laden", source: "28742cc9" } } },
    };
    before.settings.l10n = {
      de: {
        text: { preheaderText: { value: "Hallo", source: "e5f57c59" } },
        set: { direction: "rtl" },
      },
    };
    return before;
  };

  it("undoes addLocale only while the new language has no layers", () => {
    const before = structuredClone(base);
    before.settings.locales = ["de"];
    const ops: Operation[] = [{ op: "addLocale", locale: "fr" }];
    const inverse = invertOperations(before, ops);
    expect(inverse).toEqual([
      { op: "removeLocale", locale: "fr", expect: { blocks: {} } },
    ]);
    const after = applyOperations(before, ops);
    expect(applyOperations(after, inverse)).toEqual(before);
    const changed = applyOperations(after, [
      {
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "fr",
        text: { content: translated },
      },
    ]);
    expect(refusal(() => applyOperations(changed, inverse))).toBe(
      "precondition_failed",
    );
    const settingsChanged = applyOperations(after, [
      { op: "updateSettingsLocale", locale: "fr", set: { width: 640 } },
    ]);
    expect(refusal(() => applyOperations(settingsChanged, inverse))).toBe(
      "precondition_failed",
    );
  });

  it("undoes removeLocale with layers in order and guards restored paths", () => {
    const before = withLayers();
    const ops: Operation[] = [{ op: "removeLocale", locale: "de" }];
    const inverse = invertOperations(before, ops);
    expect(inverse.map((op) => op.op)).toEqual([
      "addLocale",
      "updateBlockLocale",
      "updateBlockLocale",
      "updateSettingsLocale",
    ]);
    expect(inverse[0]).toEqual({ op: "addLocale", locale: "de", position: 0 });
    const after = applyOperations(before, ops);
    expect(applyOperations(after, inverse)).toEqual(before);
    const changed = applyOperations(after, [
      inverse[0],
      { op: "updateBlockLocale", blockId: "t1", locale: "de", hidden: true },
    ]);
    expect(refusal(() => applyOperations(changed, inverse.slice(1)))).toBe(
      "precondition_failed",
    );
    const settingsChanged = applyOperations(after, [
      inverse[0],
      { op: "updateSettingsLocale", locale: "de", set: { direction: "ltr" } },
    ]);
    expect(
      refusal(() => applyOperations(settingsChanged, inverse.slice(1))),
    ).toBe("precondition_failed");
  });

  it("undoes mixed block text, set, unset and hidden with guards on both kinds", () => {
    const before = withLayers();
    const ops: Operation[] = [
      {
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "de",
        text: { content: { value: "Neu", source: "67eb44ba" } },
        set: { align: "right" },
        unset: ["color"],
        hidden: false,
      },
    ];
    const inverse = invertOperations(before, ops);
    expect(inverse).toEqual([
      {
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "de",
        unset: ["content", "align", "color"],
        text: { content: translated },
        set: { color: "red" },
        hidden: true,
        expect: {
          text: {
            content: { value: "Neu", source: "67eb44ba" },
            align: null,
            color: null,
          },
          set: { content: null, align: "right", color: null },
          hidden: false,
        },
      },
    ]);
    const after = applyOperations(before, ops);
    expect(applyOperations(after, inverse)).toEqual(before);
    for (const edit of [
      { set: { content: "Later" } },
      { hidden: true },
      { set: { color: "blue" } },
    ]) {
      const changed = applyOperations(after, [
        { op: "updateBlockLocale", blockId: "t1", locale: "de", ...edit },
      ]);
      expect(refusal(() => applyOperations(changed, inverse))).toBe(
        "precondition_failed",
      );
    }
  });

  it("undoes settings text, set and unset and refuses later settings changes", () => {
    const before = withLayers();
    const ops: Operation[] = [
      {
        op: "updateSettingsLocale",
        locale: "de",
        text: { preheaderText: { value: "Neu", source: "e5f57c59" } },
        unset: ["direction"],
        set: { width: 640 },
      },
    ];
    const inverse = invertOperations(before, ops);
    const after = applyOperations(before, ops);
    expect(applyOperations(after, inverse)).toEqual(before);
    const changed = applyOperations(after, [
      { op: "updateSettingsLocale", locale: "de", set: { direction: "ltr" } },
    ]);
    expect(refusal(() => applyOperations(changed, inverse))).toBe(
      "precondition_failed",
    );
  });

  it("undoes addLocale followed by a text edit in reverse batch order", () => {
    const before = structuredClone(base);
    before.settings.locales = ["de"];
    const ops: Operation[] = [
      { op: "addLocale", locale: "fr" },
      {
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "fr",
        text: { content: translated },
      },
    ];
    const inverse = invertOperations(before, ops);
    expect(inverse.map((op) => op.op)).toEqual([
      "updateBlockLocale",
      "removeLocale",
    ]);
    const after = applyOperations(before, ops);
    expect(applyOperations(after, inverse)).toEqual(before);
    const changed = applyOperations(after, [
      { op: "updateBlockLocale", blockId: "t1", locale: "fr", hidden: true },
    ]);
    expect(refusal(() => applyOperations(changed, inverse))).toBe(
      "precondition_failed",
    );
  });
});
