import { describe, expect, it, vi } from "vitest";
import {
  OperationError,
  applyOperations,
  createDefaultTemplateContent,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  invertOperations,
  resolveLocale,
  sourceHash,
  type Block,
  type CustomBlockDefinition,
  type Operation,
  type TemplateContent,
} from "@templatical/types";
import { mapLocalizedOperations } from "../src/index";
import * as contentDiff from "../src/diff-content";

const paragraph = (id = "p1") => createParagraphBlock({ id, content: "Hello" });
const content = (blocks: Block[] = [paragraph()]): TemplateContent => ({
  ...createDefaultTemplateContent(),
  blocks,
  settings: {
    ...createDefaultTemplateContent().settings,
    locale: "en",
    locales: ["de", "fr"],
    preheaderText: "Preview",
  },
});

/** Check both projections, exact operations, purity and the undo round trip. */
function check(
  base: TemplateContent,
  ops: Operation[],
  expected: Operation[],
  shared: Operation[] = [],
  definitions?: readonly CustomBlockDefinition[],
) {
  const original = structuredClone(base);
  const mapped = mapLocalizedOperations(base, "de", ops, definitions);
  expect(mapped).toEqual(expected);
  const result = applyOperations(base, mapped);
  expect(resolveLocale(result, "de")).toEqual(
    applyOperations(resolveLocale(base, "de"), ops),
  );
  expect(resolveLocale(result, "en")).toEqual(
    applyOperations(resolveLocale(base, "en"), shared),
  );
  expect(applyOperations(result, invertOperations(base, mapped))).toEqual(base);
  expect(base).toEqual(original);
  return { result, mapped };
}

describe("mapLocalizedOperations", () => {
  it("maps paragraph content to text stamped with the default value's hash", () => {
    const base = content();
    base.blocks[0].l10n = {
      de: { text: { content: { value: "Alt", source: "old" } } },
      fr: { text: { content: { value: "Bonjour", source: "old" } } },
    };
    const { result } = check(
      base,
      [{ op: "updateBlock", blockId: "p1", set: { content: "Hallo" } }],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          text: { content: { value: "Hallo", source: sourceHash("Hello") } },
        },
      ],
    );
    expect(result.blocks[0].l10n?.fr).toEqual(base.blocks[0].l10n.fr);
  });

  it("maps nested padding to set without changing default styles", () => {
    const block = paragraph();
    const styles = {
      ...block.styles,
      padding: { ...block.styles.padding, top: 24 },
    };
    check(
      content([block]),
      [{ op: "updateBlock", blockId: "p1", set: { styles } }],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          set: { "styles.padding.top": 24 },
        },
      ],
    );
  });

  it("adds German text as the new block's shared default", () => {
    const block = createParagraphBlock({ id: "new", content: "Neu" });
    const ops: Operation[] = [
      { op: "addBlock", block, parent: null, after: "p1" },
    ];
    const { result } = check(content(), ops, ops, ops);
    expect(result.blocks[1]).toEqual(block);
    expect(result.blocks[1].l10n).toBeUndefined();
  });

  it("deletes a block and its layers in every language", () => {
    const block = paragraph();
    block.l10n = {
      de: { text: { content: { value: "Hallo", source: "old" } } },
    };
    const ops: Operation[] = [
      {
        op: "deleteBlock",
        blockId: "p1",
        expect: { block: resolveLocale(content([block]), "de").blocks[0] },
      },
    ];
    const expected: Operation[] = [{ op: "deleteBlock", blockId: "p1" }];
    check(content([block]), ops, expected, expected);
  });

  it("keeps edits to a newly added block shared across an explicit move", () => {
    const block = createParagraphBlock({ id: "new", content: "Neu" });
    const ops: Operation[] = [
      { op: "addBlock", block, parent: null, after: "p1" },
      { op: "moveBlock", blockId: "new", parent: null, after: null },
      { op: "updateBlock", blockId: "new", set: { content: "Neuer Text" } },
    ];
    const { result } = check(content(), ops, ops, ops);
    expect(result.blocks[0]).toEqual({ ...block, content: "Neuer Text" });
  });

  it("keeps a move's identity and precondition when its adjacent neighbour is locked", () => {
    const base = content([paragraph("a"), paragraph("b")]);
    const move: Operation = {
      op: "moveBlock",
      blockId: "a",
      parent: null,
      after: "b",
      expect: { parent: null, after: null },
    };
    const { mapped, result } = check(base, [move], [move], [move]);
    expect(
      applyOperations(base, mapped, {
        locks: [{ blockId: "b", sessionId: "peer", locale: null }],
        session: "self",
      }),
    ).toEqual(result);
    expect(result.blocks.map((block) => block.id)).toEqual(["b", "a"]);
  });

  it("maps settings preheader to text and direction to set", () => {
    check(
      content(),
      [
        {
          op: "updateSettings",
          set: { preheaderText: "Vorschau", direction: "rtl" },
        },
      ],
      [
        {
          op: "updateSettingsLocale",
          locale: "de",
          text: {
            preheaderText: { value: "Vorschau", source: sourceHash("Preview") },
          },
          set: { direction: "rtl" },
        },
      ],
    );
  });

  it("addresses menu text by item id", () => {
    const menu = createMenuBlock({
      id: "menu",
      items: [{ id: "home", text: "Home", url: "/" }],
    });
    check(
      content([menu]),
      [
        {
          op: "updateBlock",
          blockId: "menu",
          set: { items: [{ id: "home", text: "Start", url: "/" }] },
        },
      ],
      [
        {
          op: "updateBlockLocale",
          blockId: "menu",
          locale: "de",
          text: {
            "items.home.text": { value: "Start", source: sourceHash("Home") },
          },
        },
      ],
    );
  });

  it.each<{ ops: Operation[] }>([
    { ops: [] },
    { ops: [{ op: "updateBlock", blockId: "p1", set: { content: "Hello" } }] },
  ])("returns no operations for an unchanged projection ($ops)", ({ ops }) => {
    check(content(), ops, []);
  });

  it("returns no operations for edits that cancel each other", () => {
    check(
      content(),
      [
        { op: "updateBlock", blockId: "p1", set: { content: "Hallo" } },
        { op: "updateBlock", blockId: "p1", set: { content: "Hello" } },
      ],
      [],
    );
  });

  it("propagates the engine refusal with the original operation index", () => {
    const base = content();
    const original = structuredClone(base);
    const ops: Operation[] = [
      { op: "updateBlock", blockId: "p1", set: { content: "Hallo" } },
      { op: "moveBlock", blockId: "p1", parent: null, after: null },
      { op: "deleteBlock", blockId: "missing" },
    ];
    expect(() => mapLocalizedOperations(base, "de", ops)).toThrow(
      OperationError,
    );
    expect(() => mapLocalizedOperations(base, "de", ops)).toThrow(
      expect.objectContaining({
        code: "block_missing",
        opIndex: 2,
        blockId: "missing",
      }),
    );
    expect(base).toEqual(original);
  });

  it("restores the entire base with the mapped batch's inverse", () => {
    const base = content([paragraph("a"), paragraph("b")]);
    base.blocks[0].l10n = {
      de: { text: { content: { value: "Alt", source: "old" } } },
    };
    const move: Operation = {
      op: "moveBlock",
      blockId: "a",
      parent: null,
      after: "b",
    };
    check(
      base,
      [
        { op: "updateBlock", blockId: "a", set: { content: "Neu" } },
        move,
        { op: "updateSettings", set: { direction: "rtl" } },
      ],
      [
        move,
        {
          op: "updateBlockLocale",
          blockId: "a",
          locale: "de",
          text: { content: { value: "Neu", source: sourceHash("Hello") } },
        },
        { op: "updateSettingsLocale", locale: "de", set: { direction: "rtl" } },
      ],
      [move],
    );
  });

  it("preserves a hidden root and all its children during a visible edit", () => {
    const hidden = createSectionBlock({
      id: "hidden",
      children: [[paragraph("secret")]],
      l10n: { de: { hidden: true } },
    });
    const { result } = check(
      content([hidden, paragraph()]),
      [{ op: "updateBlock", blockId: "p1", set: { content: "Hallo" } }],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          text: { content: { value: "Hallo", source: sourceHash("Hello") } },
        },
      ],
    );
    expect(result.blocks[0]).toEqual(hidden);
  });

  it("preserves a hidden child while editing its section and adding a sibling", () => {
    const hidden = paragraph("hidden");
    hidden.l10n = {
      de: {
        hidden: true,
        text: { content: { value: "Geheim", source: "old" } },
      },
    };
    const section = createSectionBlock({
      id: "section",
      children: [[hidden, paragraph()]],
    });
    const added = createParagraphBlock({ id: "new", content: "Neu" });
    const add: Operation = {
      op: "addBlock",
      block: added,
      parent: { sectionId: "section", column: 0 },
      after: "p1",
    };
    const { result } = check(
      content([section]),
      [
        {
          op: "updateBlock",
          blockId: "section",
          set: { backgroundColor: "#ffffff" },
        },
        add,
      ],
      [
        add,
        {
          op: "updateBlockLocale",
          blockId: "section",
          locale: "de",
          set: { backgroundColor: "#ffffff" },
        },
      ],
      [add],
    );
    expect((result.blocks[0] as typeof section).children[0][0]).toEqual(hidden);
  });

  it("keeps equal-default translations on touched and untouched blocks", () => {
    const a = paragraph("a");
    const b = paragraph("b");
    for (const block of [a, b])
      block.l10n = {
        de: { text: { content: { value: "Hello", source: "old" } } },
      };
    const { result } = check(
      content([a, b]),
      [{ op: "updateBlock", blockId: "a", set: { color: "#ffffff" } }],
      [
        {
          op: "updateBlockLocale",
          blockId: "a",
          locale: "de",
          set: { color: "#ffffff" },
        },
      ],
    );
    expect(result.blocks[0].l10n?.de.text).toEqual(a.l10n?.de.text);
    expect(result.blocks[1]).toEqual(b);
  });

  it("leaves existing text in set when another property changes", () => {
    const block = paragraph();
    block.l10n = { de: { set: { content: "Hallo" } } };
    const { result } = check(
      content([block]),
      [{ op: "updateBlock", blockId: "p1", set: { color: "#ffffff" } }],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          set: { color: "#ffffff" },
        },
      ],
    );
    expect(result.blocks[0].l10n?.de).toEqual({
      set: { content: "Hallo", color: "#ffffff" },
    });
  });

  it.each([
    { text: { preheaderText: { value: "Preview", source: "old" } } },
    { set: { preheaderText: "Vorschau" } },
  ])("preserves untouched settings text (%j)", (layer) => {
    const base = content();
    base.settings.l10n = { de: layer };
    const { result } = check(
      base,
      [{ op: "updateSettings", set: { direction: "rtl" } }],
      [
        {
          op: "updateSettingsLocale",
          locale: "de",
          set: { direction: "rtl" },
        },
      ],
    );
    expect(result.settings.l10n?.de).toEqual({
      ...layer,
      set: { ...layer.set, direction: "rtl" },
    });
  });

  it("resets a changed translation to its default and prunes the empty layer", () => {
    const block = paragraph();
    block.l10n = {
      de: { text: { content: { value: "Hallo", source: "old" } } },
    };
    const { result } = check(
      content([block]),
      [{ op: "updateBlock", blockId: "p1", set: { content: "Hello" } }],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          unset: ["content"],
        },
      ],
    );
    expect(result.blocks[0].l10n).toBeUndefined();
  });

  it("uses set when a translatable field has no default value", () => {
    const image = createImageBlock({ id: "image" });
    delete image.alt;
    check(
      content([image]),
      [{ op: "updateBlock", blockId: "image", set: { alt: "Bild" } }],
      [
        {
          op: "updateBlockLocale",
          blockId: "image",
          locale: "de",
          set: { alt: "Bild" },
        },
      ],
    );
  });

  it("uses custom definitions for text and keeps cached default HTML", () => {
    const block = {
      id: "custom",
      type: "custom",
      customType: "card",
      fieldValues: { headline: "Hello", color: "#000000" },
      renderedHtml: "<p>Hello</p>",
      l10n: { de: { set: { "fieldValues.color": "#111111" } } },
    } as Block;
    const definitions = [
      {
        type: "card",
        fields: [
          { key: "headline", type: "text" },
          { key: "color", type: "color" },
        ],
      },
    ] as CustomBlockDefinition[];
    const { result } = check(
      content([block]),
      [
        {
          op: "updateBlock",
          blockId: "custom",
          set: { fieldValues: { headline: "Hallo", color: "#ffffff" } },
        },
      ],
      [
        {
          op: "updateBlockLocale",
          blockId: "custom",
          locale: "de",
          text: {
            "fieldValues.headline": {
              value: "Hallo",
              source: sourceHash("Hello"),
            },
          },
          set: { "fieldValues.color": "#ffffff" },
        },
      ],
      [],
      definitions,
    );
    expect(result.blocks[0]).toEqual({
      ...block,
      l10n: {
        de: {
          text: {
            "fieldValues.headline": {
              value: "Hallo",
              source: sourceHash("Hello"),
            },
          },
          set: { "fieldValues.color": "#ffffff" },
        },
      },
    });
  });

  it("shares menu item additions and removals and prunes orphan translations", () => {
    const menu = createMenuBlock({
      id: "menu",
      items: [
        { id: "old", text: "Old", url: "/old" },
        { id: "home", text: "Home", url: "/" },
      ],
    });
    menu.l10n = {
      de: { text: { "items.old.text": { value: "Alt", source: "old" } } },
      fr: { set: { "items.old.url": "/fr" } },
    };
    const items = [
      { id: "home", text: "Home", url: "/" },
      { id: "new", text: "Neu", url: "/new" },
    ];
    const update: Operation = {
      op: "updateBlock",
      blockId: "menu",
      set: { items },
    };
    const { result } = check(
      content([menu]),
      [update],
      [
        update,
        {
          op: "updateBlockLocale",
          blockId: "menu",
          locale: "de",
          unset: ["items.old.text"],
        },
        {
          op: "updateBlockLocale",
          blockId: "menu",
          locale: "fr",
          unset: ["items.old.url"],
        },
      ],
      [update],
    );
    expect(result.blocks[0].l10n).toBeUndefined();
  });

  it("resets a leaf inside an ancestor override while preserving sibling overrides", () => {
    const block = paragraph();
    block.styles.padding = { top: 10, right: 5, bottom: 6, left: 7 };
    block.l10n = {
      de: {
        set: {
          "styles.padding": { top: 20, right: 30, bottom: 6, left: 7 },
          "styles.linkColor": "#ff0000",
        },
      },
    };
    const { result } = check(
      content([block]),
      [
        {
          op: "updateBlock",
          blockId: "p1",
          set: {
            styles: {
              ...block.styles,
              linkColor: "#ff0000",
              padding: { top: 10, right: 30, bottom: 6, left: 7 },
            },
          },
        },
      ],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          set: {
            "styles.padding.right": 30,
            "styles.padding.bottom": 6,
            "styles.padding.left": 7,
          },
          unset: ["styles.padding"],
        },
      ],
    );
    expect(result.blocks[0].l10n?.de.set).toEqual({
      "styles.padding.right": 30,
      "styles.padding.bottom": 6,
      "styles.padding.left": 7,
      "styles.linkColor": "#ff0000",
    });
  });

  it.each([
    {
      layer: { text: { content: { value: "Hello", source: "kept" } } },
      initial: "Hello",
    },
    { layer: { set: { content: "Hallo" } }, initial: "Hallo" },
  ])(
    "preserves net-unchanged text storage across a move ($layer)",
    ({ layer, initial }) => {
      const a = paragraph("a");
      a.l10n = { de: layer };
      const base = content([a, paragraph("b")]);
      base.settings.l10n = {
        de: {
          text: {
            preheaderText: { value: "Preview", source: "kept-settings" },
          },
        },
      };
      const move: Operation = {
        op: "moveBlock",
        blockId: "a",
        parent: null,
        after: "b",
      };
      const { result } = check(
        base,
        [
          { op: "updateBlock", blockId: "a", set: { content: "Zwischen" } },
          { op: "updateSettings", set: { preheaderText: "Zwischen" } },
          move,
          { op: "updateBlock", blockId: "a", set: { content: initial } },
          { op: "updateSettings", set: { preheaderText: "Preview" } },
        ],
        [move],
        [move],
      );
      expect(result.blocks[1]).toEqual(a);
      expect(result.settings).toEqual(base.settings);
    },
  );

  it.each(["root", "child"] as const)(
    "translates hidden %s move coordinates and guards with input error indices",
    (kind) => {
      const hidden = paragraph("hidden");
      hidden.l10n = { de: { hidden: true } };
      const targetHidden = paragraph("target-hidden");
      targetHidden.l10n = { de: { hidden: true } };
      const sourceParent =
        kind === "root" ? null : { sectionId: "section", column: 0 };
      const parent =
        kind === "root" ? null : { sectionId: "section", column: 1 };
      const base =
        kind === "root"
          ? content([hidden, paragraph("a"), paragraph("b")])
          : content([
              createSectionBlock({
                id: "section",
                columns: "2",
                children: [
                  [hidden, paragraph("a"), paragraph("b")],
                  [targetHidden, paragraph("c")],
                ],
              }),
            ]);
      const move: Operation = {
        op: "moveBlock",
        blockId: "a",
        parent,
        after: kind === "root" ? "b" : null,
        expect: { parent: sourceParent, after: null },
      };
      const mapped: Operation = {
        ...move,
        after: kind === "root" ? "b" : "target-hidden",
        expect: { parent: sourceParent, after: "hidden" },
      };
      const noop: Operation = {
        op: "updateBlock",
        blockId: "a",
        set: { content: "Hello" },
      };
      const invalid: Operation = {
        ...move,
        expect: { parent: sourceParent, after: "b" },
      };
      expect(() => mapLocalizedOperations(base, "de", [noop, invalid])).toThrow(
        expect.objectContaining({
          code: "precondition_failed",
          opIndex: 1,
          blockId: "a",
        }),
      );
      check(base, [noop, move], [mapped], [mapped]);
    },
  );

  it("rebalances a hidden child out of a dropped column before shrinking", () => {
    const hidden = paragraph("hidden");
    hidden.l10n = {
      de: {
        hidden: true,
        text: { content: { value: "Geheim", source: "old" } },
      },
      fr: { set: { color: "#ff0000" } },
    };
    const section = createSectionBlock({
      id: "section",
      columns: "2",
      children: [[paragraph("a")], [hidden]],
    });
    const resize: Operation = {
      op: "updateBlock",
      blockId: "section",
      set: { columns: "1" },
      expect: { columns: "2" },
    };
    const mapped: Operation[] = [
      {
        op: "moveBlock",
        blockId: "hidden",
        parent: { sectionId: "section", column: 0 },
        after: "a",
      },
      resize,
    ];
    const { result } = check(content([section]), [resize], mapped, mapped);
    expect((result.blocks[0] as typeof section).children).toEqual([
      [paragraph("a"), hidden],
    ]);
    expect(
      (resolveLocale(result, "de").blocks[0] as typeof section).children,
    ).toEqual([[paragraph("a")]]);
  });

  it("recreates a removed ancestor override with a changed leaf", () => {
    const block = paragraph();
    block.styles.padding = { top: 10, right: 5, bottom: 6, left: 7 };
    block.l10n = { de: { set: { "styles.padding": null } } };
    const padding = { top: 20, right: 5, bottom: 6, left: 7 };
    const { result } = check(
      content([block]),
      [
        {
          op: "updateBlock",
          blockId: "p1",
          set: { styles: { ...block.styles, padding } },
        },
      ],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          set: { "styles.padding": padding },
        },
      ],
    );
    expect(result.blocks[0].l10n?.de).toEqual({
      set: { "styles.padding": padding },
    });
  });

  it("keeps deleted and re-added ids in separate lifetimes across edits and a move", () => {
    const old = paragraph();
    old.l10n = {
      de: { text: { content: { value: "Alt", source: "old" } } },
      fr: { text: { content: { value: "Bonjour", source: "old" } } },
    };
    const block = createParagraphBlock({ id: "p1", content: "Neu" });
    const remove: Operation = { op: "deleteBlock", blockId: "p1" };
    const add: Operation = { op: "addBlock", block, parent: null, after: null };
    const move: Operation = {
      op: "moveBlock",
      blockId: "p1",
      parent: null,
      after: "b",
    };
    const final: Operation = {
      op: "updateBlock",
      blockId: "p1",
      set: { content: "Neuer Text" },
    };
    const { result } = check(
      content([old, paragraph("b")]),
      [
        { op: "updateBlock", blockId: "p1", set: { content: "Bearbeitet" } },
        remove,
        add,
        { op: "updateBlock", blockId: "p1", set: { content: "Zwischen" } },
        move,
        final,
      ],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          text: {
            content: { value: "Bearbeitet", source: sourceHash("Hello") },
          },
        },
        remove,
        add,
        move,
        final,
      ],
      [remove, add, move, final],
    );
    expect(result.blocks[1]).toEqual({ ...block, content: "Neuer Text" });
  });

  it("reconciles masked descendants when rebuilding an ancestor override", () => {
    const block = paragraph();
    block.styles.padding = { top: 10, right: 5, bottom: 6, left: 7 };
    block.l10n = {
      de: {
        set: {
          "styles.padding": null,
          "styles.padding.top": 20,
          "styles.padding.left": 7,
          "styles.linkColor": "#ff0000",
        },
      },
    };
    const padding = { top: 10, right: 6, bottom: 6, left: 7 };
    const { result } = check(
      content([block]),
      [
        {
          op: "updateBlock",
          blockId: "p1",
          set: { styles: { ...block.styles, linkColor: "#ff0000", padding } },
        },
      ],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          set: { "styles.padding": padding },
          unset: ["styles.padding.top"],
        },
      ],
    );
    expect(result.blocks[0].l10n?.de.set).toEqual({
      "styles.padding": padding,
      "styles.padding.left": 7,
      "styles.linkColor": "#ff0000",
    });
  });

  it.each(["plain", "different locale with language versions"])(
    "refuses a whole-template replacement at its input index (%s)",
    (scenario) => {
      const base = content();
      const original = structuredClone(base);
      const replacement = resolveLocale(content([paragraph("new")]), "de");
      if (scenario !== "plain") {
        replacement.settings.locale = "fr";
        replacement.settings.locales = ["de"];
      }
      let error: unknown;
      try {
        mapLocalizedOperations(base, "de", [
          { op: "updateBlock", blockId: "p1", set: { content: "Hallo" } },
          { op: "setContent", content: replacement },
        ]);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(OperationError);
      expect(error).toMatchObject({
        code: "invalid_operation",
        opIndex: 1,
        message:
          "Replacing the whole template isn't possible in a language view; switch to the default language.",
      });
      expect(base).toEqual(original);
    },
  );

  it("refuses a whole-template fallback from an internal property diff", () => {
    const base = content();
    const original = structuredClone(base);
    const diff = vi
      .spyOn(contentDiff, "diffContent")
      .mockReturnValueOnce([{ op: "setContent", content: base }]);
    let error: unknown;
    try {
      mapLocalizedOperations(base, "de", [
        { op: "updateSettings", set: { preheaderText: "Preview" } },
        { op: "updateBlock", blockId: "p1", set: { content: "Hallo" } },
      ]);
    } catch (caught) {
      error = caught;
    } finally {
      diff.mockRestore();
    }
    expect(error).toBeInstanceOf(OperationError);
    expect(error).toMatchObject({
      code: "invalid_operation",
      opIndex: 1,
      message:
        "Replacing the whole template isn't possible in a language view; switch to the default language.",
    });
    expect(base).toEqual(original);
  });

  it.each<{ name: string; operation: Operation }>([
    { name: "set", operation: { op: "updateSettings", set: { locale: "fr" } } },
    { name: "unset", operation: { op: "updateSettings", unset: ["locale"] } },
  ])(
    "refuses a settings locale $name at its input index in German",
    ({ operation }) => {
      const base = content();
      const original = structuredClone(base);
      let error: unknown;
      try {
        mapLocalizedOperations(base, "de", [
          { op: "updateBlock", blockId: "p1", set: { content: "Hallo" } },
          operation,
        ]);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(OperationError);
      expect(error).toMatchObject({
        code: "invalid_operation",
        opIndex: 1,
        message:
          "The default locale can't change while language versions exist.",
      });
      expect(base).toEqual(original);
    },
  );

  it("restores the German projection after undoing an overlapping override edit", () => {
    const block = paragraph();
    block.styles.padding = { top: 10, right: 5, bottom: 6, left: 7 };
    block.l10n = {
      de: {
        set: {
          "styles.padding": { top: 20, right: 30, bottom: 6, left: 7 },
          "styles.padding.top": 10,
        },
      },
    };
    const base = content([block]);
    const before = resolveLocale(base, "de");
    const padding = { top: 10, right: 40, bottom: 6, left: 7 };
    const { result, mapped } = check(
      base,
      [
        {
          op: "updateBlock",
          blockId: "p1",
          set: { styles: { ...block.styles, padding } },
        },
      ],
      [
        {
          op: "updateBlockLocale",
          blockId: "p1",
          locale: "de",
          set: { "styles.padding": padding },
        },
      ],
    );
    const restored = applyOperations(result, invertOperations(base, mapped));
    expect(restored).toEqual(base);
    expect(resolveLocale(restored, "de")).toEqual(before);
    expect(resolveLocale(restored, "de").blocks[0].styles.padding).toEqual({
      top: 10,
      right: 30,
      bottom: 6,
      left: 7,
    });
  });
});

it("preserves a sibling edit combined with an inherited reset in mapped operations", () => {
  const block = paragraph();
  block.styles.padding = { top: 10, right: 5, bottom: 6, left: 7 };
  block.l10n = {
    de: {
      set: {
        "styles.padding": { top: 20, right: 30, bottom: 6, left: 7 },
      },
    },
  };
  const base = content([block]);
  const mapped = mapLocalizedOperations(base, "de", [
    {
      op: "updateBlock",
      blockId: "p1",
      set: {
        styles: {
          ...block.styles,
          padding: { top: 10, right: 40, bottom: 6, left: 7 },
        },
      },
    },
  ]);
  const updated = applyOperations(base, mapped);

  expect(resolveLocale(updated, "de").blocks[0].styles.padding).toEqual({
    top: 10,
    right: 40,
    bottom: 6,
    left: 7,
  });
  const changedDefault = applyOperations(updated, [
    {
      op: "updateBlock",
      blockId: "p1",
      set: {
        styles: {
          ...updated.blocks[0].styles,
          padding: { top: 42, right: 5, bottom: 6, left: 7 },
        },
      },
    },
  ]);
  expect(resolveLocale(changedDefault, "de").blocks[0].styles.padding).toEqual({
    top: 42,
    right: 40,
    bottom: 6,
    left: 7,
  });
});
