import { describe, expect, it } from "vitest";
import type { Block, TemplateContent } from "@templatical/types";
import { applyOperations } from "@templatical/types";
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
