import { describe, expect, it } from "vitest";
import type { Block, TemplateContent } from "@templatical/types";
import { applyOperations, invertOperations } from "@templatical/types";
import { diffContent } from "../src/diff-content";
import {
  createGenerator,
  randomContent,
  randomEdit,
} from "./helpers/random-content";

const leaf = (id: string, extra: Record<string, unknown> = {}): Block =>
  ({
    id,
    type: "paragraph",
    content: `<p>${id}</p>`,
    ...extra,
  }) as unknown as Block;
const section = (id: string, columns: string, children: Block[][]): Block =>
  ({ id, type: "section", columns, children }) as unknown as Block;
const wrapper = (id: string, children: Block[]): Block =>
  ({ id, type: "wrapper", children }) as unknown as Block;
const content = (
  blocks: Block[],
  settings: Record<string, unknown> = { width: 600 },
): TemplateContent => ({ blocks, settings }) as unknown as TemplateContent;

/** The diff, and a check that it really produces `after`. */
function diff(before: TemplateContent, after: TemplateContent) {
  const ops = diffContent(before, after);
  expect(applyOperations(before, ops)).toEqual(
    JSON.parse(JSON.stringify(after)),
  );
  return ops;
}

describe("diffContent", () => {
  it("moves a nested section child to its wrapper sibling list", () => {
    const before = content([wrapper("A", [section("S", "1", [[leaf("X")]])])]);
    const after = content([wrapper("A", [section("S", "1", [[]]), leaf("X")])]);
    expect(diff(before, after)).toEqual([
      { op: "moveBlock", blockId: "X", parent: { wrapperId: "A" }, after: "S" },
    ]);
  });

  it("adds a wrapper with new children and moves an existing block into it", () => {
    const before = content([leaf("X")]);
    const after = content([wrapper("A", [leaf("N"), leaf("X")])]);
    expect(diff(before, after)).toEqual([
      {
        op: "addBlock",
        block: wrapper("A", [leaf("N")]),
        parent: null,
        after: null,
      },
      { op: "moveBlock", blockId: "X", parent: { wrapperId: "A" }, after: "N" },
    ]);
  });

  it("moves a survivor out before deleting its old wrapper", () => {
    const before = content([wrapper("A", [leaf("X")])]);
    const after = content([leaf("X")]);
    expect(diff(before, after)).toEqual([
      { op: "moveBlock", blockId: "X", parent: null, after: null },
      { op: "deleteBlock", blockId: "A" },
    ]);
  });

  it("removes a section's own wrapper before moving it into a layout wrapper", () => {
    const framed = { ...section("S", "1", [[]]), wrapper: { padding: "8px" } };
    const before = content([wrapper("A", [leaf("X")]), framed as Block]);
    const after = content([wrapper("A", [leaf("X"), section("S", "1", [[]])])]);
    const ops = diff(before, after);
    expect(ops).toEqual([
      { op: "updateBlock", blockId: "S", unset: ["wrapper"] },
      { op: "moveBlock", blockId: "S", parent: { wrapperId: "A" }, after: "X" },
    ]);
    const applied = applyOperations(before, ops);
    expect(applyOperations(applied, invertOperations(before, ops))).toEqual(
      JSON.parse(JSON.stringify(before)),
    );
  });

  it("moves a section out of a layout wrapper before giving it its own wrapper", () => {
    const framed = { ...section("S", "1", [[]]), wrapper: { padding: "8px" } };
    const before = content([
      wrapper("A", [leaf("X"), section("S", "1", [[]])]),
    ]);
    const after = content([wrapper("A", [leaf("X")]), framed as Block]);
    expect(diff(before, after)).toEqual([
      { op: "moveBlock", blockId: "S", parent: null, after: "A" },
      { op: "updateBlock", blockId: "S", set: { wrapper: { padding: "8px" } } },
    ]);
  });

  it("is empty for equal content, whatever the key order", () => {
    const before = content([leaf("a", { color: "#000" })]);
    const after = content([
      {
        color: "#000",
        content: "<p>a</p>",
        type: "paragraph",
        id: "a",
      } as unknown as Block,
    ]);

    expect(diffContent(before, after)).toEqual([]);
  });

  it("moves a top-level block instead of deleting and re-adding it", () => {
    const before = content([leaf("a"), leaf("b"), leaf("c")]);
    const after = content([leaf("c"), leaf("a"), leaf("b")]);

    expect(diff(before, after)).toEqual([
      { op: "moveBlock", blockId: "c", parent: null, after: null },
    ]);
  });

  it("moves a block between columns of a section", () => {
    const before = content([
      section("s", "2", [[leaf("a"), leaf("b")], [leaf("c")]]),
    ]);
    const after = content([
      section("s", "2", [[leaf("a")], [leaf("c"), leaf("b")]]),
    ]);

    expect(diff(before, after)).toEqual([
      {
        op: "moveBlock",
        blockId: "b",
        parent: { sectionId: "s", column: 1 },
        after: "c",
      },
    ]);
  });

  it("drags a block from the top level into a column and back out", () => {
    const before = content([leaf("a"), section("s", "1", [[leaf("b")]])]);
    const after = content([section("s", "1", [[leaf("a")]]), leaf("b")]);

    expect(diff(before, after)).toEqual([
      { op: "moveBlock", blockId: "b", parent: null, after: "s" },
      {
        op: "moveBlock",
        blockId: "a",
        parent: { sectionId: "s", column: 0 },
        after: null,
      },
    ]);
  });

  it("moves blocks out of shrinking columns before the columns change", () => {
    // The section toolbar merges a dropped column into the last kept one.
    const before = content([
      section("s", "3", [[leaf("a")], [leaf("b")], [leaf("c")]]),
    ]);
    const after = content([
      section("s", "2", [[leaf("a")], [leaf("b"), leaf("c")]]),
    ]);

    expect(diff(before, after)).toEqual([
      {
        op: "moveBlock",
        blockId: "c",
        parent: { sectionId: "s", column: 1 },
        after: "b",
      },
      { op: "updateBlock", blockId: "s", set: { columns: "2" } },
    ]);
  });

  it("grows columns before moving a block into a new one", () => {
    const before = content([section("s", "1", [[leaf("a"), leaf("b")]])]);
    const after = content([section("s", "2", [[leaf("a")], [leaf("b")]])]);

    expect(diff(before, after)).toEqual([
      { op: "updateBlock", blockId: "s", set: { columns: "2" } },
      {
        op: "moveBlock",
        blockId: "b",
        parent: { sectionId: "s", column: 1 },
        after: null,
      },
    ]);
  });

  it("grows to four columns before a block can land in a new one", () => {
    const before = content([section("s", "2", [[leaf("a")], [leaf("b")]])]);
    const after = content([
      section("s", "4", [[leaf("a")], [leaf("b")], [], [leaf("c")]]),
    ]);

    expect(diff(before, after)).toEqual([
      { op: "updateBlock", blockId: "s", set: { columns: "4" } },
      {
        op: "addBlock",
        block: leaf("c"),
        parent: { sectionId: "s", column: 3 },
        after: null,
      },
    ]);
  });

  it("moves blocks out of a shrinking four-column section before the columns change", () => {
    const before = content([
      section("s", "4", [[leaf("a")], [leaf("b")], [leaf("c")], [leaf("d")]]),
    ]);
    const after = content([
      section("s", "1-2-1", [[leaf("a")], [leaf("b")], [leaf("c"), leaf("d")]]),
    ]);

    expect(diff(before, after)).toEqual([
      {
        op: "moveBlock",
        blockId: "d",
        parent: { sectionId: "s", column: 2 },
        after: "c",
      },
      { op: "updateBlock", blockId: "s", set: { columns: "1-2-1" } },
    ]);
  });

  it("changes a two-column layout to 1-3 without moving children", () => {
    const before = content([section("s", "2", [[leaf("a")], [leaf("b")]])]);
    const after = content([section("s", "1-3", [[leaf("a")], [leaf("b")]])]);

    expect(diff(before, after)).toEqual([
      { op: "updateBlock", blockId: "s", set: { columns: "1-3" } },
    ]);
  });

  it("changes a layout with the same column count as a plain key change", () => {
    const before = content([section("s", "2", [[leaf("a")], []])]);
    const after = content([section("s", "2-1", [[leaf("a")], []])]);

    expect(diff(before, after)).toEqual([
      { op: "updateBlock", blockId: "s", set: { columns: "2-1" } },
    ]);
  });

  it("deletes a section only after moving its surviving blocks out", () => {
    const before = content([
      leaf("a"),
      section("s", "2", [[leaf("b")], [leaf("c")]]),
    ]);
    const after = content([leaf("a"), leaf("c")]);

    expect(diff(before, after)).toEqual([
      { op: "moveBlock", blockId: "c", parent: null, after: "a" },
      { op: "deleteBlock", blockId: "s" },
    ]);
  });

  it("deletes a section and its children in one operation when none survive", () => {
    const before = content([section("s", "1", [[leaf("a")]]), leaf("b")]);
    const after = content([leaf("b")]);

    expect(diff(before, after)).toEqual([{ op: "deleteBlock", blockId: "s" }]);
  });

  it("adds a new section with its new children and moves existing ones in", () => {
    const before = content([leaf("a")]);
    const after = content([section("s", "2", [[leaf("n")], [leaf("a")]])]);

    expect(diff(before, after)).toEqual([
      {
        op: "addBlock",
        block: section("s", "2", [[leaf("n")], []]),
        parent: null,
        after: null,
      },
      {
        op: "moveBlock",
        blockId: "a",
        parent: { sectionId: "s", column: 1 },
        after: null,
      },
    ]);
  });

  it("sets changed keys and unsets removed ones, replacing objects whole", () => {
    const before = content([
      leaf("a", {
        styles: { padding: 1, backgroundColor: "#fff" },
        color: "#000",
      }),
    ]);
    const after = content([leaf("a", { styles: { padding: 2 } })]);

    expect(diff(before, after)).toEqual([
      {
        op: "updateBlock",
        blockId: "a",
        set: { styles: { padding: 2 } },
        unset: ["color"],
      },
    ]);
  });

  it("treats a key holding undefined as absent", () => {
    const before = content([leaf("a", { color: "#000" })]);
    const after = content([
      leaf("a", { color: undefined, wrapper: undefined }),
    ]);

    expect(diff(before, after)).toEqual([
      { op: "updateBlock", blockId: "a", unset: ["color"] },
    ]);
  });

  it("diffs settings with set and unset", () => {
    const before = content([], { width: 600, linkColor: "#00f" });
    const after = content([], { width: 640 });

    expect(diff(before, after)).toEqual([
      { op: "updateSettings", set: { width: 640 }, unset: ["linkColor"] },
    ]);
  });

  it("deletes and re-adds a block whose type changed", () => {
    const before = content([leaf("a")]);
    const after = content([
      { id: "a", type: "title", content: "<p>a</p>" } as unknown as Block,
    ]);

    expect(diff(before, after)).toEqual([
      { op: "deleteBlock", blockId: "a" },
      {
        op: "addBlock",
        block: { id: "a", type: "title", content: "<p>a</p>" },
        parent: null,
        after: null,
      },
    ]);
  });

  it("copies what it sends, so later edits to the content can't change a pending batch", () => {
    const before = content([]);
    const after = content([leaf("a", { styles: { padding: 1 } })]);

    const ops = diffContent(before, after);
    (
      after.blocks[0] as unknown as { styles: { padding: number } }
    ).styles.padding = 9;

    expect(ops[0]).toEqual({
      op: "addBlock",
      block: {
        id: "a",
        type: "paragraph",
        content: "<p>a</p>",
        styles: { padding: 1 },
      },
      parent: null,
      after: null,
    });
  });

  it("round-trips 500 seeded random edits", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const gen = createGenerator(seed);
      const before = randomContent(gen);
      const after = randomEdit(gen, before);
      const ops = diffContent(before, after);
      expect(applyOperations(before, ops), `seed ${seed}`).toEqual(
        JSON.parse(JSON.stringify(after)),
      );
      expect(
        ops.some((op) => op.op === "setContent"),
        `seed ${seed}`,
      ).toBe(false);
    }
  });
});

describe("diffContent localization", () => {
  it("keeps an already visible wrapper visible when moving a slot into it", () => {
    const slot = { id: "slot", type: "slot" } as Block;
    const beforeWrapper = wrapper("A", []);
    beforeWrapper.l10n = { de: { hidden: false } };
    const afterWrapper = wrapper("A", [slot]);
    afterWrapper.l10n = { de: { hidden: false } };
    const settings = { width: 600, locale: "en", locales: ["de"] };
    const before = content([slot, beforeWrapper], settings);
    const after = content([afterWrapper], settings);
    expect(diff(before, after)).toEqual([
      {
        op: "moveBlock",
        blockId: "slot",
        parent: { wrapperId: "A" },
        after: null,
      },
    ]);
  });

  it("unhides a wrapper before moving a slot into its child list", () => {
    const slot = { id: "slot", type: "slot" } as Block;
    const before = content([slot, wrapper("A", [])], {
      width: 600,
      locale: "en",
      locales: ["de"],
    });
    before.blocks[1].l10n = { de: { hidden: true } };
    const after = content([wrapper("A", [slot])], {
      width: 600,
      locale: "en",
      locales: ["de"],
    });
    expect(diff(before, after)).toEqual([
      { op: "updateBlockLocale", blockId: "A", locale: "de", hidden: false },
      {
        op: "moveBlock",
        blockId: "slot",
        parent: { wrapperId: "A" },
        after: null,
      },
    ]);
  });

  it.each(["add", "move"])(
    "unhides an enclosing wrapper before a slot %s into its section",
    (kind) => {
      const slot = { id: "slot", type: "slot" } as Block;
      const hidden = wrapper("A", [section("S", "1", [[]])]);
      hidden.l10n = { de: { hidden: true } };
      const settings = { width: 600, locale: "en", locales: ["de"] };
      const before = content(
        kind === "move" ? [slot, hidden] : [hidden],
        settings,
      );
      const after = content(
        [wrapper("A", [section("S", "1", [[slot]])])],
        settings,
      );

      const ops = diffContent(before, after);
      const applied = applyOperations(before, ops);
      expect(ops).toEqual([
        { op: "updateBlockLocale", blockId: "A", locale: "de", hidden: false },
        kind === "move"
          ? {
              op: "moveBlock",
              blockId: "slot",
              parent: { sectionId: "S", column: 0 },
              after: null,
            }
          : {
              op: "addBlock",
              block: slot,
              parent: { sectionId: "S", column: 0 },
              after: null,
            },
      ]);
      expect(applied).toEqual(after);
      expect(applyOperations(applied, invertOperations(before, ops))).toEqual(
        before,
      );
    },
  );

  it("defers wrapper unhide after adding a non-slot block to its section", () => {
    const hidden = { de: { hidden: true } };
    const settings = { width: 600, locale: "en", locales: ["de"] };
    const beforeWrapper = wrapper("A", [section("S", "1", [[]])]);
    const afterWrapper = wrapper("A", [section("S", "1", [[leaf("text")]])]);
    beforeWrapper.l10n = hidden;
    const before = content([beforeWrapper], settings);
    const after = content([afterWrapper], settings);

    expect(diff(before, after)).toEqual([
      {
        op: "addBlock",
        block: leaf("text"),
        parent: { sectionId: "S", column: 0 },
        after: null,
      },
      { op: "updateBlockLocale", blockId: "A", locale: "de", hidden: false },
    ]);
  });

  const settings = { width: 600, locale: "en", locales: ["de", "fr"] };
  const translated = { value: "Hallo", sourceHash: "12345678" };

  it("emits German text as exactly one locale operation", () => {
    const before = content([leaf("t1")], settings);
    const after = content(
      [leaf("t1", { l10n: { de: { text: { content: translated } } } })],
      settings,
    );
    expect(diff(before, after)).toEqual([
      {
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "de",
        text: { content: translated },
      },
    ]);
  });

  it("adds a locale before its block operations, carrying a new block's layer", () => {
    const before = content([leaf("t1")], { width: 600, locale: "en" });
    const added = leaf("new", { l10n: { de: { hidden: true } } });
    const after = content(
      [leaf("t1", { l10n: { de: { text: { content: translated } } } }), added],
      { width: 600, locale: "en", locales: ["de"] },
    );
    expect(diff(before, after)).toEqual([
      { op: "addBlock", block: added, parent: null, after: "t1" },
      { op: "addLocale", locale: "de" },
      {
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "de",
        text: { content: translated },
      },
    ]);
  });

  it("removes a locale last without other operations for its removed layers or expect", () => {
    const before = content(
      [leaf("t1", { l10n: { de: { text: { content: translated } } } })],
      { ...settings, l10n: { de: { set: { direction: "rtl" } } } },
    );
    const after = content([leaf("t1", { content: "Changed" })], {
      width: 640,
      locale: "en",
      locales: ["fr"],
    });
    expect(diff(before, after)).toEqual([
      { op: "updateBlock", blockId: "t1", set: { content: "Changed" } },
      { op: "updateSettings", set: { width: 640 } },
      { op: "removeLocale", locale: "de" },
    ]);
  });

  it("toggles hidden and omits the emptied layer", () => {
    const before = content([leaf("t1")], settings);
    const after = content(
      [leaf("t1", { l10n: { de: { hidden: true } } })],
      settings,
    );
    expect(diff(before, after)).toEqual([
      { op: "updateBlockLocale", blockId: "t1", locale: "de", hidden: true },
    ]);
    expect(diff(after, before)).toEqual([
      { op: "updateBlockLocale", blockId: "t1", locale: "de", hidden: false },
    ]);
  });

  it("unsets removed set and text paths, and changes their kind", () => {
    const before = content(
      [
        leaf("t1", {
          color: "#000",
          l10n: {
            de: { set: { color: "#fff" }, text: { content: translated } },
          },
        }),
      ],
      settings,
    );
    const after = content(
      [
        leaf("t1", {
          color: "#000",
          l10n: { de: { set: { content: "Override" } } },
        }),
      ],
      settings,
    );
    expect(diff(before, after)).toEqual([
      {
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "de",
        set: { content: "Override" },
        unset: ["content", "color"],
      },
    ]);
  });

  it("diffs settings layers by locale with removed paths", () => {
    const before = content([], {
      ...settings,
      preheaderText: "Hello",
      l10n: { de: { set: { direction: "rtl" } } },
    });
    const after = content([], {
      ...settings,
      preheaderText: "Hello",
      l10n: {
        de: { text: { preheaderText: translated } },
        fr: { set: { direction: "rtl" } },
      },
    });
    expect(diff(before, after)).toEqual([
      {
        op: "updateSettingsLocale",
        locale: "de",
        text: { preheaderText: translated },
        unset: ["direction"],
      },
      { op: "updateSettingsLocale", locale: "fr", set: { direction: "rtl" } },
    ]);
  });
});

it.each([
  "default with versions",
  "default gaining versions",
  "default without versions",
  "add",
  "remove",
  "layer",
  "prune",
])("round-trips locale transitions: %s", (kind) => {
  const before = content([leaf("t1")], { locale: "en", width: 600 });
  if (["default with versions", "remove", "layer", "prune"].includes(kind))
    before.settings.locales = ["de"];
  if (kind === "prune") {
    before.settings.preheaderText = "Hello";
    before.settings.l10n = {
      de: {
        text: { preheaderText: { value: "Hallo", sourceHash: "f55c314b" } },
      },
    };
  }
  const after = JSON.parse(JSON.stringify(before)) as TemplateContent;
  if (kind.startsWith("default")) {
    after.settings.locale = "fr";
    delete after.settings.locales;
    if (kind === "default gaining versions") after.settings.locales = ["en"];
  }
  if (kind === "add") after.settings.locales = ["de"];
  if (kind === "remove") delete after.settings.locales;
  if (kind === "layer")
    after.blocks[0].l10n = {
      de: { text: { content: { value: "Hallo", sourceHash: "12345678" } } },
    };
  if (kind === "prune") {
    delete after.settings.preheaderText;
    delete after.settings.l10n;
  }
  const ops = diffContent(before, after);
  expect(applyOperations(before, ops)).toEqual(after);
  if (kind === "default with versions" || kind === "default gaining versions")
    expect(ops).toEqual([{ op: "setContent", content: after }]);
});

it("keeps default-language rebases explicit instead of inventing setDefaultLocale in a diff", () => {
  const before = content([leaf("t1")], {
    width: 600,
    locale: "en",
    locales: ["de"],
  });
  const after = applyOperations(before, [
    { op: "setDefaultLocale", locale: "de" },
  ]);
  expect(diff(before, after)).toEqual([{ op: "setContent", content: after }]);
});
